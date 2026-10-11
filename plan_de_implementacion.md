Plan de Implementación: TP6 - Network Diagnostics Suite
Este plan está basado en la arquitectura de 5 capas propuesta en el documento (Discovery, Protocol, Evidence, Local Store, Sync, Reporting) y estructurado para ir resolviendo los problemas técnicos de mayor a menor riesgo.

Fase 1: Base y Arquitectura Offline-First (Local Store & Sync)
Objetivo: Dejar armada la base de datos local y la cola de sincronización, ya que todo en la app pasa por acá.

Inicializar proyecto con React Native CLI (TypeScript recomendado).
Configurar WatermelonDB para la persistencia local de equipos, diagnósticos y reportes.
Implementar patrón Outbox: una tabla en WatermelonDB para encolar acciones (reportes, sincronizaciones).
Integrar @react-native-community/netinfo para escuchar cambios de red y disparar el vaciado de la cola (Outbox) cuando vuelva internet (RF-07).
Fase 2: Capa de Descubrimiento (Discovery Layer)
Objetivo: Encontrar los equipos en la red local (RF-01).

Instalar y configurar react-native-zeroconf para mDNS/Bonjour.
Instalar react-native-udp y react-native-tcp-socket.
Desarrollar la lógica de escaneo ARP-like para listar IPs, MACs y Hostnames de la subred activa.
Fase 3: Capa de Protocolo (SNMP y SSH)
Objetivo: Comunicarse con los equipos descubiertos (RF-02, RF-03).

SNMP:
Usar react-native-udp para enviar paquetes GetRequest al puerto 161.
Desarrollar un parser/decodificador simplificado de ASN.1/BER para leer las respuestas de los OIDs (uptime, sysName, interfaces).
SSH:
Integrar react-native-ssh-sftp.
Implementar el gestor seguro de credenciales usando react-native-keychain para no guardar passwords en texto plano.
Armar la consola para ejecutar los comandos de diagnóstico.
Fase 4: Evidencia e Identificación (Evidence Layer)
Objetivo: Usar hardware del teléfono para el relevamiento de campo (RF-04, RF-05).

Configurar permisos de cámara y GPS en Android.
Integrar react-native-vision-camera (junto con el modelo de escaneo) para leer QRs/Códigos de barras y sacar fotos de la instalación.
Integrar react-native-geolocation-service para adjuntar latitud/longitud a la evidencia.
Fase 5: Reportes (Reporting Layer)
Objetivo: Empaquetar la evidencia (RF-06).

Integrar react-native-html-to-pdf.
Crear un template HTML dinámico que reciba los datos del equipo, diagnóstico, fotos y GPS.
Generar el PDF y guardarlo localmente, registrando la ruta en WatermelonDB para futura sincronización.
Fase 6: UI/UX (Capa de Presentación)
Objetivo: Armar las pantallas según los diseños proporcionados. (Esta fase se trabajará en paralelo con las anteriores a medida que envíes las capturas)

Pantalla de Escaneo (LAN/mDNS).
Ficha técnica del equipo (Historial offline - RF-08).
Consola de diagnóstico.
Formulario de instalación (Cámara + GPS).
