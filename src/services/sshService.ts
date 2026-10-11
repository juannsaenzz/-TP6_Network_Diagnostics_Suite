import SSH from 'react-native-ssh-sftp';
import * as Keychain from 'react-native-keychain';

export class SSHService {
  // Guarda las credenciales de forma segura
  static async saveCredentials(ip: string, username: string, password: string): Promise<boolean> {
    try {
      const result = await Keychain.setGenericPassword(username, password, {
        service: `ssh_${ip}`,
      });
      return !!result;
    } catch (error) {
      console.error('Error saving credentials:', error);
      return false;
    }
  }

  // Recupera las credenciales
  static async getCredentials(ip: string): Promise<{ username: string; password: string } | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: `ssh_${ip}`,
      });
      if (credentials) {
        return {
          username: credentials.username,
          password: credentials.password,
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting credentials:', error);
      return null;
    }
  }

  // Ejecuta un comando SSH de forma segura usando las credenciales guardadas
  static async executeCommand(ip: string, command: string, providedUsername?: string, providedPassword?: string): Promise<string> {
    let username = providedUsername;
    let password = providedPassword;

    if (!username || !password) {
      const creds = await this.getCredentials(ip);
      if (creds) {
        username = creds.username;
        password = creds.password;
      } else {
        throw new Error('Credenciales no encontradas o no provistas');
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const client = new SSH(ip, 22, username, password, (connectError: any) => {
          if (connectError) {
            return reject('Error de conexión: ' + connectError);
          }
          
          client.execute(command, (execError: any, response: string) => {
            client.disconnect();
            if (execError) {
              reject('Error de comando: ' + execError);
            } else {
              resolve(response || 'OK');
            }
          });
        });
      } catch (e: any) {
        reject('Error interno: ' + e.toString());
      }
    });
  }
}
