import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Modal, Alert, PermissionsAndroid, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import Geolocation from 'react-native-geolocation-service';
import { database } from '../db';
import { Colors, Typography, Shadows } from '../theme';

const EvidenceFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const deviceIdStr = route.params?.deviceId || 'simulated-qr-123';
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const photoOutput = usePhotoOutput();

  useEffect(() => {
    if (cameraVisible && !hasPermission) {
      requestPermission();
    }
  }, [cameraVisible, hasPermission, requestPermission]);

  useEffect(() => {
    const requestLocationPermission = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
      }
      return true;
    };

    requestLocationPermission().then(granted => {
      if (granted) {
        Geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => console.log('Geolocation Error:', error),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      }
    });
  }, []);

  const takePhoto = async () => {
    try {
      const photoFile = await photoOutput.capturePhotoToFile({}, {});
      setPhotoUri(`file://${photoFile.filePath}`);
      setCameraVisible(false);
    } catch (e: any) {
        Alert.alert('Error', 'No se pudo tomar la foto: ' + e.toString());
    }
  };

  const saveEvidence = async () => {
    if (!photoUri && !notes) {
      Alert.alert('Atención', 'Por favor tomá una foto o escribí alguna nota.');
      return;
    }

    try {
      await database.write(async () => {
        // 1. Guardar la Instalación
        const newInst = await database.get('installations').create((record: any) => {
          record.equipmentId = deviceIdStr;
          record.qrCode = deviceIdStr;
          record.notes = notes;
          record.latitude = location?.lat || -34.6037; // usa GPS real o fallback
          record.longitude = location?.lng || -58.3816;
          record.photoPaths = JSON.stringify([photoUri]);
          record.pdfPath = '';
        });

        // 2. Guardar en Outbox para sincronización offline
        await database.get('outbox').create((outbox: any) => {
          outbox.actionType = 'SYNC_INSTALLATION';
          outbox.payload = JSON.stringify({ id: newInst.id, type: 'installation' });
          outbox.status = 'pending';
          outbox.retryCount = 0;
        });
      });

      Alert.alert('¡Excelente!', 'Evidencia guardada localmente de forma segura en WatermelonDB. Lista para sincronizar cuando haya Internet.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', 'No se pudo guardar en la base de datos: ' + e.toString());
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrar<Text style={{ color: Colors.secondary }}> Instalación</Text></Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Captura de Evidencia</Text>

        <TouchableOpacity style={styles.cameraBox} onPress={() => setCameraVisible(true)}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
          ) : (
            <>
              <Icon name="camera-alt" size={50} color={Colors.textLight} />
              <Text style={styles.cameraText}>Tomar Fotografía</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Ubicación GPS</Text>

        <View style={styles.gpsBox}>
          <Icon name="location-on" size={30} color={Colors.secondary} />
          <View style={styles.gpsTextContainer}>
            {location ? (
              <>
                <Text style={styles.gpsTitle}>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</Text>
                <Text style={styles.gpsSubtitle}>Ubicación obtenida (Alta precisión)</Text>
              </>
            ) : (
              <>
                <Text style={styles.gpsTitle}>Obteniendo coordenadas...</Text>
                <Text style={styles.gpsSubtitle}>Esperando precisión de satélites</Text>
              </>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Notas Técnicas</Text>

        <TextInput
          style={styles.notesInput}
          multiline
          numberOfLines={4}
          placeholder="Escribí acá las observaciones de la instalación (ej: puerto del switch, tipo de cable, etc.)..."
          placeholderTextColor={Colors.textLight}
          textAlignVertical="top"
          value={notes}
          onChangeText={setNotes}
        />

        <View style={styles.footer}>
          <TouchableOpacity style={styles.submitBtn} onPress={saveEvidence}>
            <Text style={styles.submitBtnText}>Generar Reporte y Guardar</Text>
            <Icon name="save" size={20} color="#FFF" style={{ marginLeft: 10 }} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Cámara */}
      <Modal visible={cameraVisible} animationType="slide" transparent={false}>
        <View style={styles.cameraModalContainer}>
          {device && hasPermission ? (
            <>
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={cameraVisible}
                outputs={[photoOutput]}
              />
              <View style={styles.cameraOverlay}>
                <TouchableOpacity style={styles.cameraCloseBtn} onPress={() => setCameraVisible(false)}>
                  <Icon name="close" size={30} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.cameraBottomBar}>
                  <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
                    <View style={styles.captureBtnInner} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.center}>
              <Text style={styles.text}>Sin acceso a la cámara o cámara no encontrada.</Text>
              <TouchableOpacity onPress={() => setCameraVisible(false)} style={{marginTop: 20}}>
                <Text style={{color: Colors.secondary, fontFamily: Typography.fontFamilyBold}}>Volver</Text>
              </TouchableOpacity>
            </View>
          )}
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
    padding: 20,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamilyBold,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 10,
    marginTop: 10,
  },
  cameraBox: {
    backgroundColor: Colors.card,
    height: 180,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  cameraText: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textLight,
    marginTop: 10,
  },
  gpsBox: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    ...Shadows.card,
  },
  gpsTextContainer: {
    marginLeft: 15,
  },
  gpsTitle: {
    fontFamily: Typography.fontFamilySemiBold,
    fontSize: 14,
    color: Colors.text,
  },
  gpsSubtitle: {
    fontFamily: Typography.fontFamily,
    fontSize: 12,
    color: Colors.textLight,
  },
  notesInput: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: Typography.fontFamily,
    color: Colors.text,
    minHeight: 120,
    marginBottom: 30,
  },
  footer: {
    marginTop: 10,
    marginBottom: 30,
  },
  submitBtn: {
    backgroundColor: Colors.secondary,
    paddingVertical: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  submitBtnText: {
    color: '#FFF',
    fontFamily: Typography.fontFamilyBold,
    fontSize: 16,
  },
  cameraModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  cameraCloseBtn: {
    marginTop: 50,
    marginLeft: 20,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 20,
  },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingVertical: 30,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.secondary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: Colors.text,
    fontFamily: Typography.fontFamily,
    fontSize: 16,
  },
});

export default EvidenceFormScreen;
