import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ScanScreen from '../screens/ScanScreen';
import DeviceDetailsScreen from '../screens/DeviceDetailsScreen';
import DiagnosticScreen from '../screens/DiagnosticScreen';
import EvidenceFormScreen from '../screens/EvidenceFormScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import DiscoveryScreen from '../screens/DiscoveryScreen';
import DeviceListScreen from '../screens/DeviceListScreen';

export type RootStackParamList = {
  Scan: undefined;
  DeviceDetails: { deviceId?: string; ip?: string; name?: string };
  Diagnostic: { deviceId?: string; ip?: string };
  EvidenceForm: { deviceId?: string; ip?: string };
  QRScanner: undefined;
  Discovery: undefined;
  DeviceList: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F5F7FA' },
        }}
      >
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="DeviceDetails" component={DeviceDetailsScreen} />
        <Stack.Screen name="Diagnostic" component={DiagnosticScreen} />
        <Stack.Screen name="EvidenceForm" component={EvidenceFormScreen} />
        <Stack.Screen name="QRScanner" component={QRScannerScreen} />
        <Stack.Screen name="Discovery" component={DiscoveryScreen} />
        <Stack.Screen name="DeviceList" component={DeviceListScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};


