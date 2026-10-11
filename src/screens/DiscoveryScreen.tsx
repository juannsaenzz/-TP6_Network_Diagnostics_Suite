import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Modal, 
  TextInput 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Colors, Typography, Shadows } from '../theme';
import { startMDNSDiscovery, stopMDNSDiscovery, DiscoveredDevice } from '../services/discoveryService';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

const DiscoveryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [manualIp, setManualIp] = useState('192.168.1.1');
  const [manualName, setManualName] = useState('Router Wi-Fi');

  const startScan = useCallback(() => {
    setIsScanning(true);
    setDevices([]);

    startMDNSDiscovery((device) => {
      setDevices(prev => {
        if (prev.find(d => d.ip === device.ip)) return prev;
        return [...prev, device];
      });
    });

    const timer = setTimeout(() => {
      stopMDNSDiscovery();
      setIsScanning(false);
    }, 8000);

    return timer;
  }, []);

  useEffect(() => {
    const timer = startScan();
    return () => {
      clearTimeout(timer);
      stopMDNSDiscovery();
    };
  }, [startScan]);

  const addQuickDevice = (ip: string, name: string) => {
    const newDev: DiscoveredDevice = {
      ip,
      name,
      hostname: `${name.toLowerCase().replace(/\s+/g, '-')}.local`,
      type: 'Manual',
    };
    setDevices(prev => {
      if (prev.find(d => d.ip === ip)) return prev;
      return [...prev, newDev];
    });
  };

  const handleAddManual = () => {
    if (!manualIp.trim()) return;
    addQuickDevice(manualIp.trim(), manualName.trim() || `Equipo (${manualIp.trim()})`);
    setModalVisible(false);
  };

  const renderItem = ({ item }: { item: DiscoveredDevice }) => (
    <TouchableOpacity 
      style={styles.deviceCard} 
      onPress={() => navigation.navigate('DeviceDetails' as any, { ip: item.ip, name: item.name, deviceId: item.ip })}
    >
      <View style={styles.deviceIcon}>
        <Icon name={item.type === 'Manual' ? "dns" : "router"} size={28} color={Colors.secondary} />
      </View>
      <View style={styles.deviceInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.deviceName}>{item.name}</Text>
          {item.type === 'Manual' && (
            <View style={styles.manualBadge}>
              <Text style={styles.manualBadgeText}>Agregado</Text>
            </View>
          )}
        </View>
        <Text style={styles.deviceIp}>{item.ip} • {item.hostname}</Text>
      </View>
      <Icon name="chevron-right" size={24} color={Colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Network <Text style={{ color: Colors.secondary }}>Discovery</Text></Text>
        <TouchableOpacity onPress={startScan} disabled={isScanning}>
          <Icon name="refresh" size={26} color={isScanning ? Colors.textLight : Colors.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Status bar */}
        <View style={styles.scanStatus}>
          {isScanning ? (
            <>
              <ActivityIndicator size="small" color={Colors.secondary} />
              <Text style={styles.scanText}>Escaneando red local (mDNS/Bonjour)...</Text>
            </>
          ) : (
            <>
              <Icon name="check-circle" size={20} color={Colors.success} />
              <Text style={styles.scanText}>Escaneo finalizado. {devices.length} equipos listos.</Text>
            </>
          )}
        </View>

        {/* Quick action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.quickAddBtn} 
            onPress={() => addQuickDevice('192.168.1.1', 'Router Wi-Fi')}
          >
            <Icon name="add" size={18} color="#0E171E" />
            <Text style={styles.quickAddBtnText}>Router Wi-Fi (192.168.1.1)</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.manualModalBtn} 
            onPress={() => setModalVisible(true)}
          >
            <Icon name="edit" size={16} color={Colors.secondary} />
            <Text style={styles.manualModalBtnText}>IP manual</Text>
          </TouchableOpacity>
        </View>

        {/* Device List */}
        <FlatList
          data={devices}
          keyExtractor={(item, index) => item.ip + index}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            !isScanning ? (
              <View style={styles.emptyContainer}>
                <Icon name="wifi-off" size={48} color={Colors.textLight} />
                <Text style={styles.emptyTitle}>0 equipos mDNS anunciados</Text>
                <Text style={styles.emptyText}>
                  Los routers Wi-Fi hogareños suelen activar aislamiento de red (AP Isolation) y bloquean el multicast mDNS.
                </Text>
                <Text style={styles.emptySubText}>
                  Tocá el botón verde de arriba para agregar tu Router Wi-Fi o cualquier IP y diagnosticarlo al instante.
                </Text>
              </View>
            ) : undefined
          }
        />
      </View>

      {/* Modal para ingresar IP Manual */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Equipo de Red</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.textLight} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Nombre del equipo:</Text>
            <TextInput
              style={styles.modalInput}
              value={manualName}
              onChangeText={setManualName}
              placeholder="Ej: Switch Core, Router Sala"
              placeholderTextColor="#666"
            />

            <Text style={styles.modalLabel}>Dirección IP:</Text>
            <TextInput
              style={styles.modalInput}
              value={manualIp}
              onChangeText={setManualIp}
              placeholder="Ej: 192.168.1.1 o 192.168.0.1"
              placeholderTextColor="#666"
              autoCapitalize="none"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSaveBtn} 
                onPress={handleAddManual}
              >
                <Text style={styles.modalSaveBtnText}>Agregar</Text>
              </TouchableOpacity>
            </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  scanStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scanText: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.text,
    marginLeft: 10,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickAddBtnText: {
    fontFamily: Typography.fontFamilyBold,
    color: '#0E171E',
    fontSize: 12,
    marginLeft: 4,
  },
  manualModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  manualModalBtnText: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.secondary,
    fontSize: 12,
    marginLeft: 6,
  },
  deviceCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    ...Shadows.card,
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontFamily: Typography.fontFamilyBold,
    color: Colors.text,
    fontSize: 15,
    marginBottom: 2,
  },
  manualBadge: {
    backgroundColor: 'rgba(78, 204, 163, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 0.5,
    borderColor: Colors.secondary,
  },
  manualBadgeText: {
    color: Colors.secondary,
    fontFamily: Typography.fontFamilySemiBold,
    fontSize: 10,
  },
  deviceIp: {
    fontFamily: Typography.fontFamily,
    color: Colors.textLight,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontFamily: Typography.fontFamilyBold,
    color: Colors.text,
    fontSize: 16,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: Typography.fontFamily,
    color: Colors.textLight,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  emptySubText: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.secondary,
    textAlign: 'center',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: Typography.fontFamilyBold,
    fontSize: 16,
    color: Colors.text,
  },
  modalLabel: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textLight,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: Colors.background,
    color: Colors.text,
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 10,
  },
  modalCancelBtnText: {
    fontFamily: Typography.fontFamily,
    color: Colors.textLight,
  },
  modalSaveBtn: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalSaveBtnText: {
    fontFamily: Typography.fontFamilyBold,
    color: '#0E171E',
  },
});

export default DiscoveryScreen;
