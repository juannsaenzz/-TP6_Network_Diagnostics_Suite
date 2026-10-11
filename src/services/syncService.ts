import NetInfo from '@react-native-community/netinfo';
import { database } from '../db';
import Outbox from '../db/models/Outbox';

// Reemplazar con la IP de tu PC (la misma que usás para Metro)
const BACKEND_URL = 'http://192.168.0.240:3000';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  totalPending: number;
  error?: string;
}

export class SyncService {
  static isSyncing = false;

  static init() {
    NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        this.syncOutbox();
      }
    });
  }

  static async syncOutbox(): Promise<SyncResult> {
    if (this.isSyncing) return { success: true, syncedCount: 0, totalPending: 0 };
    this.isSyncing = true;
    let syncedCount = 0;
    let totalPending = 0;

    try {
      const outboxCollection = database.get<Outbox>('outbox');
      const pendingItems = await outboxCollection.query().fetch();
      totalPending = pendingItems.filter(i => i.status === 'pending').length;

      for (const item of pendingItems) {
        if (item.status === 'pending') {
          try {
            // El backend espera: { deviceId, actions: [{ type, timestamp, payload }] }
            const payloadObj = JSON.parse(item.payload);
            const requestBody = {
              deviceId: 'Dispositivo_Prueba_01',
              actions: [
                {
                  type: item.actionType,
                  timestamp: new Date().toISOString(),
                  payload: payloadObj,
                }
              ]
            };

            const response = await fetch(`${BACKEND_URL}/api/sync`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });

            if (response.ok) {
              await database.write(async () => {
                await item.markAsDeleted();
              });
              syncedCount++;
              console.log(`[Sync] Item ${item.id} sincronizado con éxito.`);
            } else {
              console.log(`[Sync] Falló sincronización de ${item.id}`);
            }
          } catch (e: any) {
            console.log(`[Sync] Error de red al intentar sincronizar:`, e);
            return { 
              success: false, 
              syncedCount, 
              totalPending, 
              error: e.message || 'Error de conexión con el servidor.' 
            };
          }
        }
      }

      return { success: true, syncedCount, totalPending };
    } catch (e: any) {
      console.error('[Sync] Error leyendo base de datos:', e);
      return { 
        success: false, 
        syncedCount, 
        totalPending, 
        error: e.message || 'Error al acceder a la base de datos local.' 
      };
    } finally {
      this.isSyncing = false;
    }
  }
}
