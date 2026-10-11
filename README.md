# Network Diagnostics Suite

Suite móvil para técnicos de infraestructura y telecomunicaciones desarrollada en **React Native**, diseñada bajo una arquitectura **Offline-First**. Permite descubrir equipos en red local, auditar métricas SNMP en tiempo real, ejecutar comandos administrativos remotos vía SSH, registrar relevamientos de campo georreferenciados (fotos + GPS) y sincronizar reportes de instalación de forma transaccional.

**Materia:** Desarrollo de Aplicaciones Móviles  
**Trabajo Práctico:** TP6 — Network Diagnostics Suite  
**Alumno:** Juan Saenz  
**Año:** 2026  

---

## 🚀 Características Principales

1. **Descubrimiento en Red Local (mDNS / Bonjour) [RF-01]:**
   * Emisión y escucha de paquetes multicast UDP en `224.0.0.251:5353` vía `react-native-zeroconf`.
   * Incluye degradación elegante con entrada manual para redes con *AP Isolation* o filtros IGMP.

2. **Telemetría y Métricas SNMPv2c [RF-02]:**
   * Cliente propio ligero sobre sockets UDP sin procesar (`react-native-udp`, puerto 161).
   * Encoder y decoder BER / ASN.1 que consulta OIDs estándar de la MIB-II (Hostname, Uptime, Bytes RX/TX) sin bloquear la interfaz.

3. **Diagnóstico Remoto SSH y Seguridad [RF-03]:**
   * Ejecución interactiva de comandos (`ping`, `traceroute`, `ifconfig`, `ip route`) vía `react-native-ssh-sftp`.
   * Almacenamiento de credenciales protegido en hardware seguro mediante **Android Keystore / iOS Keychain** (`react-native-keychain`).

4. **Identificación de Activos por Código QR [RF-04]:**
   * Visión artificial mediante `react-native-vision-camera`, `react-native-nitro-image` y `jsQR`.
   * Disparador bajo demanda (*On-Demand Trigger*), normalización de paso de línea de GPU (*Row Stride*) y algoritmo de estiramiento de contraste dinámico para pantallas LCD.
   * Entrada manual de contingencia ante códigos QR dañados en el rack.

5. **Relevamiento de Campo (Fotos + GPS Satelital) [RF-05]:**
   * Captura fotográfica de evidencias con cámara de alta resolución.
   * Geoposicionamiento satelital de alta precisión vía `react-native-geolocation-service`.

6. **Generación Autónoma de Reportes PDF [RF-06]:**
   * Exportación local de informes técnicos formateados con `react-native-html-to-pdf`.
   * Evidencias fotográficas embebidas en Base64 para evitar enlaces rotos a archivos temporales.

7. **Arquitectura Offline-First con Cola Outbox [RF-07 & RF-08]:**
   * Base de datos local reactiva con **WatermelonDB (SQLite)**.
   * Patrón *Transactional Outbox* para encolar transacciones en campo y sincronizarlas automáticamente en segundo plano cuando `NetInfo` detecta conectividad activa.

---

## 📁 Estructura del Proyecto

```
NetworkDiagnosticsSuite/
├── src/
│   ├── assets/              # Fuentes tipográficas (Cairo) e imágenes
│   ├── db/                  # Esquemas y modelos reactivos de WatermelonDB (SQLite)
│   │   ├── models/          # Entidades: Outbox, Installation, Diagnostic, Equipment
│   │   └── schema.ts        # Definición de tablas y versiones de la BD
│   ├── navigation/          # React Navigation (Native Stack)
│   ├── screens/             # Vistas de la aplicación:
│   │   ├── DeviceListScreen.tsx      # Dashboard principal y métricas de red
│   │   ├── DeviceDetailsScreen.tsx   # Ficha técnica, SNMP y telemetría
│   │   ├── DiagnosticScreen.tsx      # Consola remota SSH interactiva
│   │   ├── QRScannerScreen.tsx       # Escáner óptico con visor y cámara
│   │   ├── EvidenceFormScreen.tsx    # Formulario de fotos y geolocalización
│   │   └── DiscoveryScreen.tsx       # Escáner LAN (mDNS / Zeroconf)
│   ├── services/            # Servicios desacoplados de infraestructura:
│   │   ├── snmpService.ts            # Cliente UDP BER/ASN.1
│   │   ├── sshService.ts             # Cliente SSH y Keychain
│   │   ├── syncService.ts            # Sincronización Outbox y NetInfo
│   │   ├── discoveryService.ts       # Multicast Zeroconf
│   │   ├── evidenceService.ts        # Almacenamiento local de fotos y GPS
│   │   └── reportService.ts          # Compilador HTML a PDF
│   └── theme/               # Paleta de colores, tipografía y estilos
├── sync_backend_stub/       # Backend stub ligero en Node.js/Express para pruebas de sync
├── documento_tecnico.md     # Documento técnico oficial de arquitectura
└── qr_router.png            # Código QR de prueba precargado (192.168.1.1)
```

---

## 🛠️ Requisitos Previos

* **Node.js:** v18.x o superior
* **JDK:** OpenJDK 17
* **Android Studio & SDK:** Android API Level 34 (Android 14) con NDK configurado
* **Dispositivo Android físico o emulador**

---

## 💻 Instalación y Puesta en Marcha

### 1. Clonar e Instalar Dependencias
```bash
git clone <URL_DEL_REPOSITORIO>
cd NetworkDiagnosticsSuite
npm install
```

### 2. Iniciar el Backend Stub de Sincronización (Opcional para pruebas Offline)
Para probar la sincronización automática de la cola *Outbox*:
```bash
cd sync_backend_stub
npm install
node server.js
```
*El servidor escuchará en el puerto 3000 (`http://<TU_IP_LOCAL>:3000/api/sync`).*

### 3. Iniciar el Servidor de Empaquetado Metro
En una terminal en la raíz del proyecto:
```bash
npm start
```

### 4. Compilar y Ejecutar en Android
En otra terminal:
```bash
npm run android
```

---

## 📋 Matriz de Cumplimiento de Requisitos

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

Para una explicación exhaustiva de los trade-offs de ingeniería, algoritmos criptográficos y estructura de paquetes de red, consultar [documento_tecnico.md](documento_tecnico.md).
