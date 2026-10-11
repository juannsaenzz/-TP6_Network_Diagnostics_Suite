import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation, { GeoCoordinates } from 'react-native-geolocation-service';
import { Camera } from 'react-native-vision-camera';

export class EvidenceService {
  /**
   * Solicita permisos de ubicación (solo Android, en iOS se maneja via Info.plist / Geolocation module internamente).
   */
  static async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Permiso de Ubicación',
          message: 'La aplicación necesita acceso a tu ubicación para adjuntarla a la evidencia.',
          buttonNeutral: 'Preguntar luego',
          buttonNegative: 'Cancelar',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    return false;
  }

  /**
   * Obtiene la ubicación actual del dispositivo.
   */
  static async getCurrentLocation(): Promise<GeoCoordinates> {
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) {
      throw new Error('Permisos de ubicación denegados');
    }

    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve(position.coords);
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  }

  // Permisos de cámara delegados a los componentes (hooks)

}
