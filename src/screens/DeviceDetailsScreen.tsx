import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Colors, Typography, Shadows } from '../theme';
import { ReportService, ReportData } from '../services/reportService';
import { Alert } from 'react-native';
import { database } from '../db';
import { snmpGet, OIDS } from '../services/snmpService';

// Este componente simula las filas oscuras (azul oscuro) con datos, 
// como se ve en la tercera imagen (256 GB, 100 GB, etc.) pero adaptado a la info de red.
const DataRow = ({ label, value }: { label: string, value: string }) => (
  <View style={styles.dataRowContainer}>
    <View style={styles.dataLabelContainer}>
      <View style={styles.orangeIndicator} />
      <Text style={styles.dataLabel}>{label}</Text>
    </View>
    <View style={styles.dataValueBox}>
      <Text style={styles.dataValue}>{value}</Text>
      <Icon name="check-circle" size={18} color={Colors.success} />
    </View>
  </View>
);

const DeviceDetailsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();
  const ipStr = route.params?.ip || "192.168.1.100";
  const deviceIdStr = route.params?.deviceId || ipStr || 'simulated-eq-123';
  
  const [systemName, setSystemName] = useState(route.params?.name || "Router-Core-01");
  const [macAddress, setMacAddress] = useState('00:1A:2B:3C:4D:5E');
  const [uptime, setUptime] = useState('Desconocido');
  const [rxTraffic, setRxTraffic] = useState('0 Bytes');
  const [txTraffic, setTxTraffic] = useState('0 Bytes');
  const [isLoading, setIsLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState<{type: string, date: Date, details: string, imageUri?: string | null}[]>([]);
  const [historyLimit, setHistoryLimit] = useState(5);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const fetchInfo = async () => {
      setIsLoading(true);
      
      try {
        // Intentar SNMP por separado
        const results = await snmpGet(ipStr, [OIDS.sysName, OIDS.sysUpTime, OIDS.ifInOctets1, OIDS.ifOutOctets1], 'public', 1500);
        if (mounted && results.length >= 4) {
          setSystemName(results[0]);
          setUptime(results[1] + ' ticks');
          setRxTraffic((parseInt(results[2]) / 1024 / 1024).toFixed(2) + ' MB');
          setTxTraffic((parseInt(results[3]) / 1024 / 1024).toFixed(2) + ' MB');
        }
      } catch (e) {
        // Silencioso si falla SNMP (offline)
      }

      try {
        // Buscar historial offline independientemente del SNMP
        const inst = await database.get('installations').query().fetch();
        const diag = await database.get('diagnostics').query().fetch();
        
        const myInst = inst.filter((i: any) => {
          const eqId = i.equipmentId || i._raw?.equipment_id || i.qrCode || i._raw?.qr_code;
          return eqId === deviceIdStr;
        });
        const myDiag = diag.filter((d: any) => {
          const eqId = d.equipmentId || d._raw?.equipment_id;
          return eqId === deviceIdStr;
        });
        
        const items = [
          ...myInst.map((i: any) => {
            let img = null;
            try {
              const paths = JSON.parse(i.photoPaths);
              if (paths && paths.length > 0) img = paths[0];
            } catch(err) {}
            return { 
              type: 'Evidencia (Fotos/GPS)', 
              date: new Date(i.createdAt),
              details: `Notas: ${i.notes || 'Sin notas'}\nLatitud: ${i.latitude}\nLongitud: ${i.longitude}`,
              imageUri: img
            };
          }),
          ...myDiag.map((d: any) => ({ 
            type: 'Diagnóstico SSH', 
            date: new Date(d.createdAt),
            details: d.sshOutput || 'Sin salida SSH registrada.',
            imageUri: null
          }))
        ].sort((a, b) => b.date.getTime() - a.date.getTime());
        
        if (mounted) setHistoryItems(items);
      } catch (e) {
        console.log("Error db fetch:", e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    
    if (isFocused) {
      fetchInfo();
    }
    
    return () => { mounted = false; };
  }, [ipStr, deviceIdStr, isFocused]);

  const handleGenerateReport = async () => {
    try {
      Alert.alert('Generando...', 'Recopilando datos de la base y creando PDF...');

      // Buscar instalaciones y diagnósticos en WatermelonDB
      const installationsCollection = database.get('installations');
      const diagnosticsCollection = database.get('diagnostics');

      // Traemos todos y ordenamos en JS para evitar problemas de índices
      const allInstallations = await installationsCollection.query().fetch();
      const latestInst: any = allInstallations.sort((a: any, b: any) => b.createdAt - a.createdAt)[0];

      const allDiagnostics = await diagnosticsCollection.query().fetch();
      const latestDiag: any = allDiagnostics.sort((a: any, b: any) => b.createdAt - a.createdAt)[0];

      let photoUris: string[] = [];
      let notes = 'Sin notas de instalación.';
      let location = { latitude: -34.6037, longitude: -58.3816 }; // Coordenadas por defecto

      if (latestInst) {
        notes = latestInst.notes || notes;
        location = { 
          latitude: latestInst.latitude || location.latitude, 
          longitude: latestInst.longitude || location.longitude 
        };
        if (latestInst.photoPaths) {
          try {
            const parsed = JSON.parse(latestInst.photoPaths);
            if (Array.isArray(parsed)) {
               photoUris = parsed.filter(uri => uri !== null);
            }
          } catch(e) {}
        }
      }

      let sshOutput = 'No hay diagnósticos SSH ejecutados.';
      if (latestDiag && latestDiag.sshOutput) {
        sshOutput = latestDiag.sshOutput;
      }

      const reportData: ReportData = {
        deviceName: systemName,
        ipAddress: ipStr,
        macAddress: macAddress,
        diagnostics: [
          { command: 'Última ejecución remota', output: sshOutput, timestamp: new Date() }
        ],
        evidence: {
          photoUris: photoUris,
          notes: notes,
          location: location
        }
      };
      
      const filePath = await ReportService.generateReportPDF(reportData);
      
      // Actualizar el registro de la instalación con la ruta del PDF
      if (latestInst) {
        await database.write(async () => {
          await latestInst.update((record: any) => {
            record.pdfPath = filePath;
          });
        });
      }

      Alert.alert('¡Éxito!', `PDF guardado con evidencia real en:\n${filePath}`);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'No se pudo generar el PDF');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Modal-like como en la imagen */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Device<Text style={{ fontFamily: Typography.fontFamily }}> Info</Text>
        </Text>
        <Text style={styles.headerSubtitle}>Status</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Section Divider */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>Network Data</Text>
          <View style={styles.sectionDivider} />
        </View>

        {/* Datos del equipo integrados (con SNMP) */}
        <DataRow label="IP Address" value={ipStr} />
        <DataRow label="MAC Address" value={macAddress} />
        <DataRow label="System Name" value={isLoading ? 'Consultando...' : systemName} />
        <DataRow label="Uptime" value={isLoading ? 'Consultando...' : uptime} />
        <DataRow label="Traffic (RX)" value={isLoading ? 'Consultando...' : rxTraffic} />
        <DataRow label="Traffic (TX)" value={isLoading ? 'Consultando...' : txTraffic} />

        {/* Section Divider para Historial */}
        <View style={[styles.sectionHeaderContainer, { marginTop: 30 }]}>
          <Text style={styles.sectionHeader}>Historial Offline</Text>
          <View style={styles.sectionDivider} />
        </View>

        {historyItems.length === 0 ? (
          <View style={{ paddingVertical: 10 }}>
            <Text style={{ color: Colors.textLight, textAlign: 'center' }}>No hay registros previos.</Text>
          </View>
        ) : (
          <View>
            {historyItems.slice(0, historyLimit).map((item, index) => (
              <TouchableOpacity 
                key={index} 
                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }}
                onPress={() => setSelectedHistoryItem(item)}
              >
                <Text style={{ color: Colors.secondary, fontWeight: 'bold' }}>{item.type}</Text>
                <Text style={{ color: Colors.textLight }}>{item.date.toLocaleString()}</Text>
              </TouchableOpacity>
            ))}
            
            {historyItems.length > historyLimit && (
              <TouchableOpacity 
                style={{ paddingVertical: 15, alignItems: 'center' }}
                onPress={() => setHistoryLimit(prev => prev + 5)}
              >
                <Text style={{ color: Colors.secondary, fontFamily: Typography.fontFamilySemiBold }}>Ver más...</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Botones de acción inferior */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.primaryActionBtn}
            onPress={() => navigation.navigate('Diagnostic', { deviceId: deviceIdStr, ip: ipStr })}
          >
            <Text style={styles.primaryActionText}>Ejecutar Diagnóstico (SSH)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryActionBtn}
            onPress={() => navigation.navigate('EvidenceForm', { deviceId: deviceIdStr, ip: ipStr })}
          >
            <Text style={styles.secondaryActionText}>Registrar Evidencia (Foto/GPS)</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.secondaryActionBtn, { borderColor: Colors.success }]}
            onPress={handleGenerateReport}
          >
            <Text style={[styles.secondaryActionText, { color: Colors.success }]}>Generar Reporte PDF</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de Detalle de Historial */}
      <Modal visible={!!selectedHistoryItem} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.historyDetailModal}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
              <Text style={{ fontFamily: Typography.fontFamilyBold, fontSize: 18, color: Colors.text }}>Detalle de Registro</Text>
              <TouchableOpacity onPress={() => setSelectedHistoryItem(null)}>
                <Icon name="close" size={24} color={Colors.textLight} />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              <Text style={{ fontFamily: Typography.fontFamilySemiBold, color: Colors.secondary, marginBottom: 10 }}>{selectedHistoryItem?.type}</Text>
              <Text style={{ fontFamily: Typography.fontFamily, color: Colors.text, marginBottom: 15 }}>{selectedHistoryItem?.date?.toLocaleString()}</Text>
              
              {selectedHistoryItem?.imageUri && (
                <View style={{ width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 15, backgroundColor: Colors.background }}>
                  <Image 
                    source={{ uri: selectedHistoryItem.imageUri }} 
                    style={{ width: '100%', height: '100%' }} 
                    resizeMode="cover" 
                  />
                </View>
              )}
              
              <Text style={{ fontFamily: Typography.fontFamily, color: Colors.text, lineHeight: 20 }}>
                {selectedHistoryItem?.details}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Typography.fontFamilyBold,
    fontSize: 18,
    color: Colors.text,
  },
  headerSubtitle: {
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    color: Colors.textLight,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  bigIconContainer: {
    alignSelf: 'center',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 30,
    ...Shadows.card,
    elevation: 5,
  },
  signalIconOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeaderContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionHeader: {
    fontFamily: Typography.fontFamilySemiBold,
    fontSize: 18,
    color: Colors.text,
  },
  sectionDivider: {
    height: 2,
    backgroundColor: Colors.secondary,
    width: '60%',
    marginTop: 5,
  },
  dataRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  dataLabelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  orangeIndicator: {
    width: 4,
    height: 14,
    backgroundColor: Colors.secondary,
    marginRight: 8,
    borderRadius: 2,
  },
  dataLabel: {
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    color: Colors.text,
  },
  dataValueBox: {
    flex: 2,
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dataValue: {
    fontFamily: Typography.fontFamilySemiBold,
    color: '#FFF',
    fontSize: 14,
  },
  actionsContainer: {
    marginTop: 30,
    gap: 15,
  },
  primaryActionBtn: {
    backgroundColor: Colors.secondary,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#FFF',
    fontFamily: Typography.fontFamilyBold,
    fontSize: 16,
  },
  secondaryActionBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  secondaryActionText: {
    color: Colors.secondary,
    fontFamily: Typography.fontFamilyBold,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  historyDetailModal: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    ...Shadows.card,
  },
});

export default DeviceDetailsScreen;
