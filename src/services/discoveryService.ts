import Zeroconf from 'react-native-zeroconf';

const zeroconf = new Zeroconf();

export interface DiscoveredDevice {
  ip: string;
  hostname: string;
  name: string;
  type: 'mDNS' | 'ARP' | 'Manual';
}

export const startMDNSDiscovery = (onDeviceFound: (device: DiscoveredDevice) => void) => {
  zeroconf.on('resolved', (service) => {
    if (service.addresses && service.addresses.length > 0) {
      onDeviceFound({
        ip: service.addresses[0],
        hostname: service.host || 'Unknown',
        name: service.name || 'Unknown Device',
        type: 'mDNS',
      });
    }
  });

  zeroconf.on('error', (err) => {
    console.warn('[mDNS Warning/Error]', err);
  });

  try {
    zeroconf.scan('http', 'tcp', 'local.');
  } catch (e) {
    console.warn('[Zeroconf scan error]', e);
  }

  // También probar Google Cast después de unos segundos (típico en Smart TVs y Chromecast hogareños)
  setTimeout(() => {
    try {
      zeroconf.scan('googlecast', 'tcp', 'local.');
    } catch (e) {}
  }, 4000);

  console.log('Iniciando escaneo mDNS/Bonjour...');
};

export const stopMDNSDiscovery = () => {
  try {
    zeroconf.stop();
    zeroconf.removeDeviceListeners();
  } catch (e) {}
  console.log('Escaneo mDNS detenido.');
};

// TODO: Implementar escaneo ARP-like usando react-native-udp para hacer ping broadcast
// a la subred y registrar las respuestas.
export const startARPDiscovery = () => {
  console.log('ARP discovery feature pending implementation.');
};
