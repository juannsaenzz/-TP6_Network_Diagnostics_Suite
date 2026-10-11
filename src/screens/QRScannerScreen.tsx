import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { loadImage } from 'react-native-nitro-image';
import jsQR from 'jsqr';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Colors, Typography } from '../theme';

const QRScannerScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput();

  const [qrValue, setQrValue] = useState('192.168.1.1');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const navigateToDevice = (valueToUse: string) => {
    const val = valueToUse.trim();
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(val);
    navigation.navigate('DeviceDetails', {
      deviceId: val,
      ip: isIp ? val : '192.168.1.1',
      name: isIp ? `Router Wi-Fi (${val})` : `Equipo ${val}`,
    });
  };

  const decodeFromImage = (imageObj: any, enhanceContrast: boolean = false) => {
    try {
      const raw = imageObj.toRawPixelData();
      const w = Math.floor(raw.width);
      const h = Math.floor(raw.height);
      const data = new Uint8Array(raw.buffer);

      if (w <= 0 || h <= 0 || data.length === 0) {
        return null;
      }

      // Evitar excepciones por padding/stride en la GPU de Android:
      // data.length = stride * h. Si hay stride alignment, extraemos línea por línea.
      const stride = Math.floor(data.length / h);
      const pixels = new Uint8ClampedArray(w * h * 4);
      const isBGRA = raw.pixelFormat === 'BGRA';
      const isARGB = raw.pixelFormat === 'ARGB';

      for (let y = 0; y < h; y++) {
        const srcRow = y * stride;
        const dstRow = y * w * 4;
        for (let x = 0; x < w; x++) {
          const s = srcRow + x * 4;
          const d = dstRow + x * 4;
          if (isBGRA) {
            pixels[d] = data[s + 2];     // R
            pixels[d + 1] = data[s + 1]; // G
            pixels[d + 2] = data[s];     // B
            pixels[d + 3] = data[s + 3]; // A
          } else if (isARGB) {
            pixels[d] = data[s + 1];     // R
            pixels[d + 1] = data[s + 2]; // G
            pixels[d + 2] = data[s + 3]; // B
            pixels[d + 3] = data[s];     // A
          } else {
            // RGBA
            pixels[d] = data[s];
            pixels[d + 1] = data[s + 1];
            pixels[d + 2] = data[s + 2];
            pixels[d + 3] = data[s + 3];
          }
        }
      }

      // Realce de contraste para pantallas LCD/monitores (elimina el lavado de luz de fondo)
      if (enhanceContrast) {
        let minLum = 255;
        let maxLum = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const lum = (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000;
          if (lum < minLum) minLum = lum;
          if (lum > maxLum) maxLum = lum;
        }
        const range = maxLum - minLum;
        if (range > 20) {
          for (let i = 0; i < pixels.length; i += 4) {
            pixels[i] = Math.min(255, Math.max(0, ((pixels[i] - minLum) * 255) / range));
            pixels[i + 1] = Math.min(255, Math.max(0, ((pixels[i + 1] - minLum) * 255) / range));
            pixels[i + 2] = Math.min(255, Math.max(0, ((pixels[i + 2] - minLum) * 255) / range));
          }
        }
      }

      return jsQR(pixels, w, h, {
        inversionAttempts: 'attemptBoth',
      });
    } catch (e: any) {
      console.log('Error decodificando imagen:', e?.message || e);
      return null;
    }
  };

  const handleScanRealQR = async () => {
    if (isScanning) return;
    setIsScanning(true);

    let photoRef: any = null;
    try {
      // 1. Capturar foto con orientación correcta
      let img: any = null;
      try {
        const photo = await photoOutput.capturePhoto({}, {});
        photoRef = photo;
        img = photo.toImage();
      } catch (inMemErr) {
        // Fallback a archivo si la captura en memoria no está soportada en el hardware
        const filePhoto = await photoOutput.capturePhotoToFile({}, {});
        img = await loadImage({ filePath: filePhoto.filePath });
      }

      let result: any = null;

      // Estrategia A: Recorte del visor central (512x512) - donde el usuario apunta el recuadro verde
      try {
        const startX = Math.max(0, Math.floor(img.width * 0.15));
        const startY = Math.max(0, Math.floor(img.height * 0.15));
        const endX = Math.min(img.width, Math.floor(img.width * 0.85));
        const endY = Math.min(img.height, Math.floor(img.height * 0.85));
        const cropped = img.crop(startX, startY, endX, endY);
        const croppedResized = cropped.resize(512, 512);

        // Intento 1: Detección estándar en recorte central
        result = decodeFromImage(croppedResized, false);

        // Intento 2: Con realce de contraste (clave si está apuntando a la pantalla del monitor)
        if (!result) {
          result = decodeFromImage(croppedResized, true);
        }
      } catch (cropErr) {
        console.log('Error en recorte central:', cropErr);
      }

      // Estrategia B: Imagen completa normalizada a 640px de ancho
      if (!result) {
        try {
          const targetW = 640;
          const targetH = Math.round((img.height / img.width) * 640);
          const resized = img.resize(targetW, targetH);
          result = decodeFromImage(resized, false);
          if (!result) {
            result = decodeFromImage(resized, true);
          }
        } catch (resizeErr) {
          console.log('Error en resize completo:', resizeErr);
        }
      }

      // Estrategia C: Rotaciones (90° y 270°) por si el sensor no embebió EXIF
      if (!result) {
        try {
          const targetW = 512;
          const targetH = Math.round((img.height / img.width) * 512);
          const resized = img.resize(targetW, targetH);
          
          const rot90 = resized.rotate(90);
          result = decodeFromImage(rot90, false) || decodeFromImage(rot90, true);

          if (!result) {
            const rot270 = resized.rotate(270);
            result = decodeFromImage(rot270, false) || decodeFromImage(rot270, true);
          }
        } catch (rotErr) {
          console.log('Error en rotación:', rotErr);
        }
      }

      if (result && result.data && result.data.trim()) {
        const decodedText = result.data.trim();
        Alert.alert(
          '¡Código QR Escaneado!',
          `Valor detectado: "${decodedText}"`,
          [
            {
              text: 'Identificar Equipo',
              onPress: () => navigateToDevice(decodedText),
            }
          ]
        );
      } else {
        Alert.alert(
          'No se detectó código QR',
          'Asegurate de que el código QR esté bien iluminado y enfocado dentro del recuadro.\n\n¿Querés reintentar o usar el valor del campo manual?',
          [
            { text: 'Reintentar', style: 'cancel' },
            { 
              text: `Usar "${qrValue}"`, 
              onPress: () => navigateToDevice(qrValue) 
            }
          ]
        );
      }
    } catch (err: any) {
      console.log('Error escaneando QR de cámara:', err);
      Alert.alert(
        'Fallo de captura',
        'No se pudo procesar la imagen de la cámara. Se usará el valor configurado.',
        [
          { text: 'Aceptar', onPress: () => navigateToDevice(qrValue) }
        ]
      );
    } finally {
      if (photoRef && typeof photoRef.dispose === 'function') {
        try { photoRef.dispose(); } catch (_) {}
      }
      setIsScanning(false);
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>No hay permisos de cámara</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Cámara no encontrada</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[photoOutput]}
      />
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Escanear Código QR</Text>
        </View>
        
        {/* Visor central del escáner */}
        <TouchableOpacity 
          style={styles.scanBox} 
          onPress={handleScanRealQR}
          activeOpacity={0.7}
          disabled={isScanning}
        >
          {isScanning ? (
            <ActivityIndicator size="large" color={Colors.secondary} />
          ) : (
            <>
              <View style={styles.scanCornerTL} />
              <View style={styles.scanCornerTR} />
              <View style={styles.scanCornerBL} />
              <View style={styles.scanCornerBR} />
              <View style={styles.laserLine} />
            </>
          )}
        </TouchableOpacity>
        
        <Text style={styles.instructionText}>
          {isScanning 
            ? "Analizando píxeles del código QR..." 
            : "Enfocá el código QR y tocá el recuadro para escanearlo"}
        </Text>

        {/* Panel inferior para personalizar el código o IP del router */}
        <View style={styles.bottomCard}>
          <View style={styles.bottomHeaderRow}>
            <Icon name="qr-code-scanner" size={20} color={Colors.secondary} />
            <Text style={styles.bottomCardTitle}>Código / IP del equipo:</Text>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={qrValue}
              onChangeText={setQrValue}
              placeholder="192.168.1.1 o ID de equipo"
              placeholderTextColor="#888"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity 
              style={styles.scanActionBtn} 
              onPress={handleScanRealQR}
              disabled={isScanning}
            >
              <Text style={styles.scanActionBtnText}>
                {isScanning ? "Escaneando..." : "Escanear QR"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Accesos rápidos para router hogareño o inventario */}
          <View style={styles.chipRow}>
            <TouchableOpacity 
              style={[styles.chip, qrValue === '192.168.1.1' && styles.chipActive]} 
              onPress={() => {
                setQrValue('192.168.1.1');
                navigateToDevice('192.168.1.1');
              }}
            >
              <Text style={[styles.chipText, qrValue === '192.168.1.1' && styles.chipTextActive]}>192.168.1.1</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.chip, qrValue === '192.168.0.1' && styles.chipActive]} 
              onPress={() => {
                setQrValue('192.168.0.1');
                navigateToDevice('192.168.0.1');
              }}
            >
              <Text style={[styles.chipText, qrValue === '192.168.0.1' && styles.chipTextActive]}>192.168.0.1</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.chip, qrValue === 'EQ-ROUTER-01' && styles.chipActive]} 
              onPress={() => {
                setQrValue('EQ-ROUTER-01');
                navigateToDevice('EQ-ROUTER-01');
              }}
            >
              <Text style={[styles.chipText, qrValue === 'EQ-ROUTER-01' && styles.chipTextActive]}>EQ-ROUTER-01</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  text: {
    fontFamily: Typography.fontFamily,
    color: Colors.text,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backBtn: {
    marginRight: 20,
  },
  headerTitle: {
    fontFamily: Typography.fontFamilyBold,
    fontSize: 20,
    color: '#FFF',
  },
  scanBox: {
    width: 240,
    height: 240,
    borderWidth: 1.5,
    borderColor: 'rgba(78, 204, 163, 0.4)',
    backgroundColor: 'transparent',
    borderRadius: 16,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanCornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: Colors.secondary,
    borderTopLeftRadius: 16,
  },
  scanCornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: Colors.secondary,
    borderTopRightRadius: 16,
  },
  scanCornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: Colors.secondary,
    borderBottomLeftRadius: 16,
  },
  scanCornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: Colors.secondary,
    borderBottomRightRadius: 16,
  },
  laserLine: {
    width: '85%',
    height: 2,
    backgroundColor: Colors.secondary,
    opacity: 0.8,
  },
  instructionText: {
    fontFamily: Typography.fontFamilySemiBold,
    color: '#FFF',
    textAlign: 'center',
    paddingHorizontal: 30,
    fontSize: 13,
    marginTop: 8,
  },
  bottomCard: {
    width: '92%',
    backgroundColor: 'rgba(26, 36, 43, 0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(78, 204, 163, 0.3)',
  },
  bottomHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  bottomCardTitle: {
    fontFamily: Typography.fontFamilyBold,
    color: '#FFF',
    fontSize: 14,
    marginLeft: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#0E171E',
    color: '#FFF',
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2A3B47',
    marginRight: 10,
  },
  scanActionBtn: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  scanActionBtnText: {
    fontFamily: Typography.fontFamilyBold,
    color: '#0E171E',
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chip: {
    backgroundColor: '#0E171E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A3B47',
  },
  chipActive: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(78, 204, 163, 0.15)',
  },
  chipText: {
    fontFamily: Typography.fontFamily,
    color: '#AAA',
    fontSize: 11,
  },
  chipTextActive: {
    color: Colors.secondary,
    fontFamily: Typography.fontFamilyBold,
  },
});

export default QRScannerScreen;
