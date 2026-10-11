import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Shadows } from '../theme';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SyncService } from '../services/syncService';

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

// Definimos un componente interno para las tarjetas grandes
const ActionCard = ({ title, subtitle, iconName, onPress }: { title: string, subtitle: string, iconName: string, onPress: () => void }) => (
  <TouchableOpacity style={styles.cardContainer} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.iconCircle}>
      <Icon name={iconName} size={40} color={Colors.secondary} />
    </View>
    <Text style={styles.cardTitle}>{title}</Text>
    <Text style={styles.cardSubtitle}>{subtitle}</Text>
  </TouchableOpacity>
);

const ScanScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [menuVisible, setMenuVisible] = useState(false);

  const navigateAndClose = (screen: string) => {
    setMenuVisible(false);
    if (screen) navigation.navigate(screen as any);
  };

  const handleSync = async () => {
    setMenuVisible(false);
    const result = await SyncService.syncOutbox();
    if (result.success) {
      if (result.syncedCount > 0) {
        Alert.alert(
          '¡Sincronización Exitosa!',
          `Se sincronizaron ${result.syncedCount} registro(s) pendientes con el servidor backend.`
        );
      } else {
        Alert.alert(
          'Todo al Día',
          'No hay registros pendientes. La base de datos local ya está completamente sincronizada con el servidor.'
        );
      }
    } else {
      Alert.alert(
        'Error de Conexión',
        `No se pudo conectar con el backend:\n${result.error || 'Revisá la IP del servidor en syncService.ts'}`
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Icon name="menu" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Image 
          source={require('../assets/images/logo_transparent.png')} 
          style={styles.headerLogo} 
          resizeMode="contain" 
        />
        <TouchableOpacity onPress={handleSync}>
          <Icon name="sync" size={28} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Info Card (Similar al de la imagen con el botón naranja) */}
        <View style={styles.topInfoCard}>
          <View style={styles.topInfoTextContainer}>
            <Text style={styles.topInfoTitle}>Network<Text style={{ color: Colors.secondary }}> Diagnostics</Text></Text>
            <Text style={styles.topInfoSubtitle}>Listo para escanear tu red LAN</Text>
          </View>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Action Cards */}
        <ActionCard 
          title="Identificar Equipo (QR)" 
          subtitle="Escanear código de barras o QR" 
          iconName="qr-code-scanner" 
          onPress={() => navigation.navigate('QRScanner')} 
        />

        <ActionCard 
          title="Escaneo LAN / mDNS" 
          subtitle="Descubrí equipos activos en la red local" 
          iconName="wifi-tethering" 
          onPress={() => navigation.navigate('Discovery')} 
        />
        
        <ActionCard 
          title="Equipos Registrados" 
          subtitle="Historial y base de datos offline" 
          iconName="devices" 
          onPress={() => navigation.navigate('DeviceList')} 
        />
        
      </ScrollView>

      {/* Custom Drawer Menu */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackground} onPress={() => setMenuVisible(false)} />
          <View style={[styles.drawerContainer, { paddingTop: insets.top }]}>
            <View style={styles.drawerHeader}>
              <Text style={{ fontFamily: Typography.fontFamilyBold, fontSize: 18, color: Colors.secondary }}>Network Diagnostics</Text>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <Icon name="close" size={28} color={Colors.textLight} />
              </TouchableOpacity>
            </View>
            <View style={styles.drawerMenu}>
              <TouchableOpacity style={styles.drawerMenuItem} onPress={() => navigateAndClose('QRScanner')}>
                <Icon name="qr-code-scanner" size={24} color={Colors.secondary} />
                <Text style={styles.drawerMenuText}>Identificar Equipo (QR)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerMenuItem} onPress={() => navigateAndClose('Discovery')}>
                <Icon name="wifi-tethering" size={24} color={Colors.secondary} />
                <Text style={styles.drawerMenuText}>Escaneo LAN / mDNS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerMenuItem} onPress={() => navigateAndClose('DeviceList')}>
                <Icon name="devices" size={24} color={Colors.secondary} />
                <Text style={styles.drawerMenuText}>Equipos Registrados</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: Colors.card,
    ...Shadows.card,
    elevation: 2,
    marginBottom: 5,
  },
  headerLogo: {
    width: 42,
    height: 42,
  },
  logo: {
    width: 150,
    height: 40,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  topInfoCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    ...Shadows.card,
  },
  topInfoTextContainer: {
    flex: 1,
  },
  topInfoTitle: {
    fontFamily: Typography.fontFamilyBold,
    fontSize: 20,
    color: Colors.text,
  },
  topInfoSubtitle: {
    fontFamily: Typography.fontFamily,
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 50,
  },
  primaryButtonText: {
    color: '#FFF',
    fontFamily: Typography.fontFamilyBold,
    fontSize: 14,
  },
  cardContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
    ...Shadows.card,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontFamily: Typography.fontFamilySemiBold,
    fontSize: 18,
    color: Colors.text,
    marginBottom: 5,
  },
  cardSubtitle: {
    fontFamily: Typography.fontFamily,
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  modalBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawerContainer: {
    width: '75%',
    backgroundColor: Colors.card,
    height: '100%',
    padding: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 20,
  },
  drawerLogo: {
    width: 120,
    height: 30,
  },
  drawerMenu: {
    flex: 1,
  },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  drawerMenuText: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.text,
    fontSize: 16,
    marginLeft: 15,
  },
});

export default ScanScreen;
