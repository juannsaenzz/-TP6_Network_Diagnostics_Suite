import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Colors, Typography, Shadows } from '../theme';
import { database } from '../db';
import Installation from '../db/models/Installation';

const DeviceListScreen = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [devices, setDevices] = useState<Installation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDevices = async () => {
    setIsLoading(true);
    try {
      const installationsCollection = database.get<Installation>('installations');
      const allInstallations = await installationsCollection.query().fetch();
      
      // Agrupar para mostrar equipos únicos (1 por cada ID)
      const uniqueDevicesMap = new Map<string, Installation>();
      // Ordenamos por fecha de creación descendente para quedarnos con el último
      const sorted = allInstallations.sort((a: any, b: any) => b.createdAt - a.createdAt);
      
      sorted.forEach(inst => {
        const key = inst.equipmentId || inst.qrCode || inst.id;
        if (!uniqueDevicesMap.has(key)) {
          uniqueDevicesMap.set(key, inst);
        }
      });
      
      setDevices(Array.from(uniqueDevicesMap.values()));
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchDevices();
    }
  }, [isFocused]);

  const renderItem = ({ item }: { item: Installation }) => {
    const equipmentKey = item.equipmentId || item.qrCode || item.id;
    return (
    <TouchableOpacity 
      style={styles.deviceCard} 
      onPress={() => navigation.navigate('DeviceDetails' as any, { 
        deviceId: equipmentKey,
        name: `Equipo ${equipmentKey.substring(0,6)}`,
        ip: item.latitude ? '192.168.1.100' : '192.168.0.240' // Simulado
      })}
    >
      <View style={styles.deviceIcon}>
        <Icon name="dns" size={28} color={Colors.secondary} />
      </View>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>ID: {item.qrCode || item.id}</Text>
        <Text style={styles.deviceIp}>
          Lat: {item.latitude.toFixed(4)} | Lng: {item.longitude.toFixed(4)}
        </Text>
      </View>
      <Icon name="chevron-right" size={24} color={Colors.textLight} />
    </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Equipos <Text style={{ color: Colors.secondary }}>Registrados</Text></Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.secondary} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="folder-open" size={48} color={Colors.textLight} />
                <Text style={styles.emptyText}>No hay equipos guardados en la base de datos local (WatermelonDB).</Text>
              </View>
            }
          />
        )}
      </View>
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
    padding: 20,
  },
  deviceCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    ...Shadows.card,
  },
  deviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontFamily: Typography.fontFamilyBold,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 4,
  },
  deviceIp: {
    fontFamily: Typography.fontFamily,
    color: Colors.textLight,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontFamily: Typography.fontFamily,
    color: Colors.textLight,
    marginTop: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default DeviceListScreen;
