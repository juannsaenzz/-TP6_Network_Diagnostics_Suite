import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import schema from './schema'
import Equipment from './models/Equipment'
import Diagnostic from './models/Diagnostic'
import Installation from './models/Installation'
import Outbox from './models/Outbox'

const adapter = new SQLiteAdapter({
  schema,
  // (opcional pero recomendado) dbName: 'network_diagnostics',
  // jsi: true, /* se usa true cuando el entorno nativo ya está preparado con JSI */
  onSetUpError: error => {
    console.error('Error inicializando SQLiteAdapter', error)
  }
})

export const database = new Database({
  adapter,
  modelClasses: [
    Equipment,
    Diagnostic,
    Installation,
    Outbox,
  ],
})
