import { Model } from '@nozbe/watermelondb'
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators'

export default class Equipment extends Model {
  static table = 'equipments'

  static associations = {
    diagnostics: { type: 'has_many', foreignKey: 'equipment_id' },
    installations: { type: 'has_many', foreignKey: 'equipment_id' },
  } as const

  @field('ip') ip!: string
  @field('mac') mac!: string
  @field('hostname') hostname!: string

  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date

  @children('diagnostics') diagnostics: any
  @children('installations') installations: any
}
