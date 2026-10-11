import { Model } from '@nozbe/watermelondb'
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators'

export default class Diagnostic extends Model {
  static table = 'diagnostics'

  static associations = {
    equipments: { type: 'belongs_to', key: 'equipment_id' },
  } as const

  @relation('equipments', 'equipment_id') equipment: any
  @field('equipment_id') equipmentId!: string
  
  @field('uptime') uptime!: string
  @field('interfaces_traffic') interfacesTraffic!: string
  @field('ssh_output') sshOutput!: string

  @readonly @date('created_at') createdAt!: Date
}
