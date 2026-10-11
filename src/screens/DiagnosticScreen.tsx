import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Colors, Typography, Shadows } from '../theme';
import { SSHService } from '../services/sshService';
import { database } from '../db';

const DiagnosticScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const [ip, setIp] = useState(route.params?.ip || '192.168.0.240');
  const deviceIdStr = route.params?.deviceId || 'simulated-eq-123';
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [command, setCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const [consoleOutput, setConsoleOutput] = useState<string>(
    '-- SSH Diagnostic Console --\nIngresá IP, Usuario y Contraseña para empezar.\n'
  );

  const executeRealCommand = async (cmdToRun: string) => {
    if (!ip || !username || !password) {
      setConsoleOutput(prev => prev + '\n[ERROR] Faltan credenciales.');
      return;
    }
    const actualCmd = cmdToRun.trim();
    if (!actualCmd) return;

    setCommand('');
    setConsoleOutput(prev => prev + `\n> ${actualCmd}\nEjecutando...`);
    setIsExecuting(true);

    try {
      const result = await SSHService.executeCommand(ip, actualCmd, username, password);
      setConsoleOutput(prev => prev + `\n${result}`);

      // Guardar el resultado en la base de datos para que el Reporte PDF lo pueda levantar
      await database.write(async () => {
        await database.get('diagnostics').create((record: any) => {
          record.equipmentId = deviceIdStr; 
          record.sshOutput = `> ${actualCmd}\n${result}`;
        });
      });

    } catch (error: any) {
      const errorMsg = `[ERROR] ${error.message || error}`;
      setConsoleOutput(prev => prev + `\n${errorMsg}`);
      
      // Guardamos el error en la base para que también quede registro de fallas en el reporte
      await database.write(async () => {
        await database.get('diagnostics').create((record: any) => {
          record.equipmentId = deviceIdStr; 
          record.sshOutput = `> ${actualCmd}\n${errorMsg}`;
        });
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Diagnostic<Text style={{ color: Colors.secondary }}> Console</Text></Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.terminalContainer}>
          <View style={styles.terminalHeader}>
            <View style={[styles.dot, { backgroundColor: '#FF5F56' }]} />
            <View style={[styles.dot, { backgroundColor: '#FFBD2E' }]} />
            <View style={[styles.dot, { backgroundColor: '#27C93F' }]} />
            <Text style={styles.terminalTitle}>SSH Session</Text>
          </View>
          <ScrollView style={styles.terminalBody}>
            <Text style={styles.terminalText}>{consoleOutput}</Text>
          </ScrollView>
        </View>

        <Text style={styles.sectionTitle}>Credenciales SSH</Text>
        <View style={styles.credentialsContainer}>
          <TextInput style={styles.credInput} placeholder="IP (ej: 192.168.0.240)" value={ip} onChangeText={setIp} placeholderTextColor={Colors.textLight} />
          <TextInput style={styles.credInput} placeholder="Usuario" value={username} onChangeText={setUsername} placeholderTextColor={Colors.textLight} />
          <TextInput style={styles.credInput} placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} placeholderTextColor={Colors.textLight} />
        </View>

        <Text style={styles.sectionTitle}>Comandos Rápidos</Text>
        
        <View style={styles.quickCommandsContainer}>
          <TouchableOpacity style={styles.commandBtn} onPress={() => executeRealCommand('ping -c 3 8.8.8.8')} disabled={isExecuting}>
            <Icon name="network-ping" size={20} color={Colors.primary} />
            <Text style={styles.commandText}>Ping WAN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.commandBtn} onPress={() => executeRealCommand('ip addr show')} disabled={isExecuting}>
            <Icon name="settings-ethernet" size={20} color={Colors.primary} />
            <Text style={styles.commandText}>Interfaces</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.commandBtn} onPress={() => executeRealCommand('tail -n 10 /var/log/syslog')} disabled={isExecuting}>
            <Icon name="receipt" size={20} color={Colors.primary} />
            <Text style={styles.commandText}>System Log</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.commandBtn} onPress={() => executeRealCommand('uptime')} disabled={isExecuting}>
            <Icon name="access-time" size={20} color={Colors.primary} />
            <Text style={styles.commandText}>Uptime</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <TextInput 
            style={styles.textInput} 
            placeholder="Escribí un comando manual..." 
            placeholderTextColor={Colors.textLight}
            value={command}
            onChangeText={setCommand}
            onSubmitEditing={() => executeRealCommand(command)}
            editable={!isExecuting}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={() => executeRealCommand(command)} disabled={isExecuting}>
            <Icon name="send" size={20} color={isExecuting ? '#ccc' : '#FFF'} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  terminalContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    overflow: 'hidden',
    height: 300,
    marginBottom: 25,
    ...Shadows.card,
  },
  terminalHeader: {
    backgroundColor: '#323233',
    paddingVertical: 10,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  terminalTitle: {
    color: '#8A8A8A',
    fontFamily: Typography.fontFamily,
    fontSize: 12,
    marginLeft: 10,
  },
  terminalBody: {
    padding: 15,
  },
  terminalText: {
    color: '#00FF00',
    fontFamily: 'monospace',
    fontSize: 13,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamilyBold,
    fontSize: 16,
    color: Colors.primary,
    marginBottom: 15,
  },
  quickCommandsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 25,
  },
  credentialsContainer: {
    marginBottom: 20,
    gap: 10,
  },
  credInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 15,
    height: 45,
    fontFamily: Typography.fontFamily,
    color: Colors.text,
    marginBottom: 8,
  },
  commandBtn: {
    backgroundColor: Colors.card,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: '47%',
  },
  commandText: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.text,
    marginLeft: 8,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 15,
    height: 50,
    fontFamily: Typography.fontFamily,
    marginRight: 10,
    color: Colors.text,
  },
  sendBtn: {
    backgroundColor: Colors.secondary,
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DiagnosticScreen;
