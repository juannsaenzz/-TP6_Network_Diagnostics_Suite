import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'equipments',
      columns: [
        { name: 'ip', type: 'string', isOptional: true },
        { name: 'mac', type: 'string', isOptional: true },
        { name: 'hostname', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'diagnostics',
      columns: [
        { name: 'equipment_id', type: 'string', isIndexed: true },
        { name: 'uptime', type: 'string', isOptional: true },
        { name: 'interfaces_traffic', type: 'string', isOptional: true },
        { name: 'ssh_output', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'installations',
      columns: [
        { name: 'equipment_id', type: 'string', isIndexed: true },
        { name: 'qr_code', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'latitude', type: 'number', isOptional: true },
        { name: 'longitude', type: 'number', isOptional: true },
        { name: 'photo_paths', type: 'string', isOptional: true }, // JSON array
        { name: 'pdf_path', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'outbox',
      columns: [
        { name: 'action_type', type: 'string' },
        { name: 'payload', type: 'string' }, // JSON
        { name: 'status', type: 'string' }, // 'pending', 'failed'
        { name: 'retry_count', type: 'number' },
        { name: 'created_at', type: 'number' },
      ]
    }),
  ]
})
