import { Model } from '@nozbe/watermelondb'
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators'

export default class Installation extends Model {
  static table = 'installations'

  static associations = {
    equipments: { type: 'belongs_to', key: 'equipment_id' },
  } as const

  @relation('equipments', 'equipment_id') equipment: any
  @field('equipment_id') equipmentId!: string

  @field('qr_code') qrCode!: string
  @field('notes') notes!: string
  @field('latitude') latitude!: number
  @field('longitude') longitude!: number
  @field('photo_paths') photoPaths!: string // Almacenar array como string JSON
  @field('pdf_path') pdfPath!: string

  @readonly @date('created_at') createdAt!: Date
}
