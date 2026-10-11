# Network Diagnostics Suite — Documento Técnico de Arquitectura

**Proyecto:** Suite Móvil de Diagnóstico de Red e Infraestructura de Campo  
**Plataforma:** React Native (Android / iOS) — Offline-First  
**Entregable Oficial:** Especificación Técnica de Protocolos, Seguridad y Persistencia

---

## 1. Subset del Protocolo SNMP Implementado (RF-02)

### 1.1 Motivación y Trade-offs de Diseño
El protocolo SNMP (*Simple Network Management Protocol*) es el estándar de facto para la supervisión y telemetría de equipamiento de red (switches, routers, firewalls, antenas de enlace). Sin embargo, en el ecosistema moderno de React Native no existen bibliotecas nativas de SNMP actualizadas y compatibles con las arquitecturas modernas.

**Decisión Arquitectónica:**  
En lugar de depender de librerías obsoletas o bindings Java/Objective-C no mantenidos, se diseñó e implementó un **cliente SNMP ligero propio** construido directamente sobre sockets UDP sin procesar (*raw sockets*) utilizando la biblioteca `react-native-udp`.

```
+-------------------------------------------------------------+
|                     React Native JS Layer                   |
|  [snmpService.ts] -> Codificador BER / Decodificador ASN.1 |
+-------------------------------------------------------------+
                              |
                     Datagramas UDP (Buffer)
                              v
+-------------------------------------------------------------+
|                 Capa Nativa (react-native-udp)              |
|        java.net.DatagramSocket (Android) / BSD Sockets      |
+-------------------------------------------------------------+
                              |
                    Puerto UDP 161 (SNMP)
                              v
+-------------------------------------------------------------+
|              Dispositivo de Red (Router / Switch)           |
+-------------------------------------------------------------+
```

### 1.2 Alcance y Especificación del Subset
* **Versión de Protocolo:** Exclusivamente **SNMPv2c** (RFC 1901 / RFC 3416).
* **Tipos de PDU Soportados:**
  * **`GetRequest` (0xA0):** Envío de solicitudes de lectura de un conjunto de OIDs.
  * **`GetResponse` (0xA2):** Recepción y parseo de datagramas con los valores de las variables.
  * *Operaciones excluidas por diseño:* Se omitieron operaciones `GetNextRequest`, `GetBulkRequest`, `SetRequest` y la recepción de `SNMP Traps`, dado que el objetivo de la suite de campo es la auditoría y telemetría instantánea de activos, evitando mutaciones de configuración destructivas sobre equipamiento en producción.
* **Seguridad y Autenticación:** Se utiliza autenticación basada en *Community String* (por defecto `'public'`). Se descartó la implementación de SNMPv3 (USM con HMAC-MD5/SHA y cifrado CBC-DES/AES) debido al costo computacional prohibitivo y la complejidad de las primitivas criptográficas sobre el hilo de JavaScript en un entorno móvil, reservando la capa de gestión autenticada y segura para el módulo SSH.

### 1.3 Formato BER (Basic Encoding Rules) y OIDs Implementados
El servicio construye dinámicamente paquetes estructurados bajo la notación ASN.1 codificados en BER:

$$\text{PDU SNMP} = \text{Sequence} \, [\, \text{Version (Integer: 1)} \,+\, \text{Community (OctetString)} \,+\, \text{GetRequest} \, [\, \text{ReqID} \,+\, \text{ErrStatus} \,+\, \text{ErrIndex} \,+\, \text{VarBindList} \,]\, ]$$

Los identificadores de objeto (OIDs) estandarizados de la MIB-II (RFC 1213) consultados por la aplicación son:

| OID | Nombre MIB | Tipo de Dato ASN.1 | Propósito en la App |
| :--- | :--- | :--- | :--- |
| `1.3.6.1.2.1.1.5.0` | `sysName` | `OctetString` (0x04) | Nombre o hostname del dispositivo |
| `1.3.6.1.2.1.1.3.0` | `sysUpTime` | `TimeTicks` (0x43) | Tiempo de actividad en centésimas de segundo |
| `1.3.6.1.2.1.2.2.1.10.1` | `ifInOctets.1` | `Counter32` (0x41) | Tráfico recibido acumulado en interfaz física #1 |
| `1.3.6.1.2.1.2.2.1.16.1` | `ifOutOctets.1` | `Counter32` (0x41) | Tráfico transmitido acumulado en interfaz física #1 |

### 1.4 Manejo de Concurrencia, Timeouts y Resiliencia
En redes móviles y Wi-Fi de campo, un dispositivo puede tener el puerto UDP 161 cerrado, bloqueado por firewall o estar desconectado. Para evitar congelamientos de la interfaz:
1. **Socket no bloqueante:** El socket UDP se vincula a un puerto efímero aleatorio (`port 0`) y se programa un timeout asincrónico estricto de **1500 ms**.
2. **Manejo de Errores Desacoplado:** Si se cumple el tiempo límite sin recibir respuesta, la promesa rechaza elegantemente, el socket se destruye (`socket.close()`) y la aplicación continúa cargando los datos locales sin bloquear el renderizado ni las consultas a SQLite.

---

## 2. Manejo Seguro de Credenciales SSH (RF-03)

### 2.1 Análisis de Amenazas y Modelo de Seguridad
En tareas de mantenimiento de telecomunicaciones, los técnicos deben ejecutar comandos de diagnóstico administrativo (`ping`, `traceroute`, `ifconfig`, `show ip interface brief`). Almacenar usuarios y contraseñas de switches de núcleo en bases de datos SQLite locales o almacenamiento clave-valor estándar (`AsyncStorage`) representa un **riesgo crítico**, ya que dichas bases quedan expuestas ante:
* Extracción mediante copias de seguridad de Android Debug Bridge (`adb backup`).
* Dispositivos rooteados o vulnerados con inspección directa de archivos en `/data/data/...`.
* Ataques de ingeniería inversa sobre volcados de memoria persistente.

### 2.2 Integración con Hardware Keystore / Secure Enclave
Para mitigar esta vulnerabilidad, se desacopló el almacenamiento de credenciales de la base de datos de la aplicación, implementando la biblioteca `react-native-keychain`:

* **Android:** Acceso directo a la API **Android Keystore System**. Las claves maestras de cifrado se generan y almacenan en hardware dedicado dentro del microprocesador: el **TEE** (*Trusted Execution Environment*) o **StrongBox Keymaster**, impidiendo que la clave de encriptación salga del chip criptográfico.
* **iOS:** Integración con el **Keychain Services API** respaldado por el coprocesador **Secure Enclave**.
* **Espacio de Nombres Particionado:** Las credenciales se indexan bajo claves aisladas basadas en el identificador único o IP del activo (`ssh_credentials_${deviceId}`).

### 2.3 Ciclo de Vida de las Credenciales
1. **Captura Inicial:** El usuario introduce el usuario y la contraseña por única vez en la pantalla de diagnóstico (`DiagnosticScreen`).
2. **Cifrado en Reposo:** El servicio `SSHService.saveCredentials` delega el cifrado al sistema operativo vía `Keychain.setGenericPassword`.
3. **Recuperación Volátil:** Al solicitar un diagnóstico, `SSHService.getCredentials` recupera las credenciales en memoria RAM únicamente por el tiempo de vida de la conexión.
4. **Ejecución y Auditoría:** La conexión se establece a través de `react-native-ssh-sftp`. Las salidas completas de los comandos (`stdout` y `stderr`) se guardan en la tabla `diagnostics` de WatermelonDB para auditoría e inclusión en los reportes PDF, pero **las credenciales jamás se persisten en texto plano**.

---

## 3. Arquitectura y Diseño de la Cola Offline (Offline-First) (RF-07, RF-08)

### 3.1 Problemática Operativa
El técnico de infraestructura opera habitualmente en subsuelos de centrales telefónicas, azoteas de edificios y sitios rurales donde la conectividad celular (4G/5G) o Wi-Fi es nula o intermitente. La arquitectura debe garantizar que **ningún dato, coordenada GPS o fotografía tomada en campo se pierda**, permitiendo continuar el trabajo con normalidad sin importar el estado de la conexión.

### 3.2 Patrón Arquitectónico: Outbox Pattern
La aplicación adopta el patrón de persistencia y mensajería **Transactional Outbox**, que garantiza consistencia eventual entre el dispositivo y el servidor central:

```
[ Usuario / Técnico ]
         |
   Registra Evidencia
         v
+--------------------------------------------------------------+
|                     WatermelonDB (SQLite)                    |
|                                                              |
|   1. Tabla 'installations'    2. Tabla 'diagnostics'         |
|      (Persistencia Local)        (Historial Local)           |
|                 \                      /                     |
|                  \                    /                      |
|                   v                  v                       |
|                 3. Tabla 'outbox' (Estado: 'pending')        |
+--------------------------------------------------------------+
                               |
                   ¿Hay conexión a Internet?
                   /                       \
             [ Sí ]                         [ No ]
              /                               \
             v                                 v
   POST /api/sync                       Permanece en cola
   Backend Stub (Node.js)               (NetInfo en escucha)
         |                                     |
   Respuesta 200 OK                            |
         |                                     |
         v                                     v
   Marca registro como             Reintento automático cuando
   procesado / eliminado           vuelve la conectividad
```

### 3.3 Esquema de Datos y Modelos (WatermelonDB)
WatermelonDB fue seleccionado por sobre soluciones SQLite convencionales por su arquitectura reactiva, uso de adaptadores nativos en C++ y consultas diferidas de alto rendimiento en conjuntos de datos grandes.

#### Modelo `Outbox` (Tabla `outbox`)
* `id` (String): Identificador único UUIDv4 del ítem en cola.
* `action_type` (String): Acción tipada (`SYNC_INSTALLATION`, `SYNC_DIAGNOSTIC`).
* `payload` (String / JSON): Objeto serializado con los datos completos de la entidad local (coordenadas, notas técnicas, referencias de fotos, métricas de red).
* `status` (String): Estado de la transacción (`pending`, `syncing`, `failed`).
* `created_at` (Number / Date): Marca de tiempo epoch de creación.

#### Modelo `Installation` (Tabla `installations`)
* `equipment_id` (String): Identificador del equipo o IP asociado.
* `qr_code` (String): Código QR / código de barras escaneado.
* `latitude` / `longitude` (Float): Geoposición satelital obtenida por hardware GPS.
* `photo_paths` (String / JSON): Array de rutas locales persistidas de las fotos capturadas.
* `notes` (String): Notas y observaciones del técnico de campo.
* `synced` (Boolean): Flag de sincronización con el backend.

### 3.4 Sincronización Automática e Idempotencia
El servicio `SyncService` implementa las siguientes reglas de robustez:
1. **Detección Reactiva de Estado de Red:** Se suscribe al evento `NetInfo.addEventListener`. Cuando la propiedad `isConnected` es verdadera y `isInternetReachable !== false`, se gatilla automáticamente el proceso de sincronización en segundo plano sin intervención humana.
2. **Mecanismo de Exclusión Mutua (`isSyncing` Lock):** Se utiliza un flag en memoria para evitar colisiones o condiciones de carrera si múltiples eventos de red o toques del usuario en la UI ocurren simultáneamente.
3. **Confirmación Transaccional:**
   * La app empaqueta los ítems pendientes en lotes hacia el backend stub (`http://192.168.0.240:3000/api/sync`).
   * Únicamente tras recibir un código de estado `HTTP 200 OK`, el ítem de la tabla `outbox` se elimina o marca como sincronizado dentro de una transacción atómica `database.write()`.
   * Si ocurre un error de timeout, rechazo de socket o caída de señal a mitad de la transferencia, el registro permanece inmutable en la base de datos local para el siguiente reintento.

---

## 4. Módulos Complementarios de la Plataforma

### 4.1 Descubrimiento en Red Local (mDNS / Bonjour) (RF-01)
* **Librería:** `react-native-zeroconf`.
* **Mecanismo de Red:** Emisión y captura de paquetes UDP multicast en la dirección `224.0.0.251` (puerto 5353).
* **Permisos Críticos en Android:** Para que el controlador de red Wi-Fi de Android no descarte los paquetes multicast entrantes para ahorrar batería, se integraron explícitamente en el manifiesto:
  * `android.permission.CHANGE_WIFI_MULTICAST_STATE`
  * `android.permission.ACCESS_WIFI_STATE`
  * `android.permission.ACCESS_NETWORK_STATE`
* **Degradación Elegante (Graceful Degradation):** En redes hogareñas o corporativas con *AP Isolation* o filtros IGMP que bloquean el tráfico multicast, la app detecta la finalización sin resultados e incorpora controles de contingencia para ingresar la puerta de enlace predeterminada (`192.168.1.1` / `192.168.0.1`) o IPs manuales, asegurando la continuidad del flujo técnico.

### 4.2 Identificación y Relevamiento de Campo (RF-04, RF-05)
* **Motor Óptico de Escaneo QR (RF-04):**
  * **Captura en Memoria y Visión Artificial:** Se combina `react-native-vision-camera` con `jsQR` y extracción de búferes crudos en memoria C++ (`react-native-nitro-image`). En lugar de correr escaneo continuo a 30 FPS que degradaría la batería y el rendimiento térmico del móvil, se implementó un disparador bajo demanda (*On-Demand Trigger*) al tocar el visor.
  * **Normalización de GPU Row Stride:** En Android, los controladores gráficos suelen alinear los buffers a múltiplos de 16/32 bytes agregando bytes de relleno (*padding*). El pipeline normaliza la matriz píxel a píxel extrayendo filas considerando el paso exacto (`stride = data.length / h`), evitando errores de tamaño o desfasajes oblicuos en el decodificador.
  * **Realce de Contraste para Pantallas Digitales:** Incorpora un algoritmo de estiramiento de histograma de contraste dinámico para contrarrestar el lavado de luz de fondo (*backlight bleed*) y los patrones de interferencia (*moiré*) cuando el técnico apunta a un monitor o pantalla de laptop en lugar de una etiqueta impresa.
  * **Degradación Elegante (Graceful Degradation):** Ante códigos QR físicamente dañados, rotos o ilegibles en el rack, la interfaz provee un campo manual de contingencia y chips de acceso rápido a IPs estándar (`192.168.1.1`, `192.168.0.1`), garantizando que el técnico nunca quede bloqueado en campo.
* **Geolocalización Satelital (RF-05):** Empleo de `react-native-geolocation-service` con proveedor de alta precisión (`enableHighAccuracy: true`), garantizando coordenadas reales de longitud y latitud al momento del relevamiento.

### 4.3 Generación de Reportes PDF Autónomos (RF-06)
* **Librería:** `react-native-html-to-pdf`.
* **Autonomía Documental:** Para evitar enlaces rotos a rutas de archivos temporales de Android (`file:///data/user/0/...`), las imágenes de la evidencia fotográfica se convierten a base64 y se embeben directamente en el documento.
* **Estructura del Reporte:**
  * Cabecera técnica del activo (Nombre, IP, MAC).
  * Evidencia de campo georreferenciada (Latitud, Longitud, Notas del técnico, Foto del equipo físico embebida).
  * Historial de diagnósticos remotos (Comandos ejecutados y salida de terminal preformateada).

---

## 5. Resumen de Requisitos y Cumplimiento

| Identificador | Requisito del PRD | Estado | Componente Principal |
| :---: | :--- | :---: | :--- |
| **RF-01** | Descubrimiento en LAN (mDNS / Bonjour) | **Cumplido** | `discoveryService.ts` (`react-native-zeroconf`) |
| **RF-02** | Consulta de Métricas SNMP (UDP raw) | **Cumplido** | `snmpService.ts` (`react-native-udp`) |
| **RF-03** | Diagnóstico Remoto SSH y Credenciales | **Cumplido** | `sshService.ts` (`react-native-ssh-sftp` + Keychain) |
| **RF-04** | Identificación de Equipo por QR / Código | **Cumplido** | `QRScannerScreen.tsx` (`react-native-vision-camera`) |
| **RF-05** | Captura de Evidencia (Fotos + GPS real) | **Cumplido** | `EvidenceFormScreen.tsx` (`geolocation-service`) |
| **RF-06** | Generación de Reporte de Instalación PDF | **Cumplido** | `reportService.ts` (`react-native-html-to-pdf`) |
| **RF-07** | Cola de Sincronización Offline-First | **Cumplido** | `syncService.ts` (Patrón Outbox + `NetInfo`) |
| **RF-08** | Visualización de Historial Offline | **Cumplido** | `DeviceDetailsScreen.tsx` (WatermelonDB + Modal) |
