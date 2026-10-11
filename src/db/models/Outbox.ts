import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Outbox extends Model {
  static table = 'outbox'

  @field('action_type') actionType!: string
  @field('payload') payload!: string // Almacenar el payload como string JSON
  @field('status') status!: string // 'pending' | 'failed'
  @field('retry_count') retryCount!: number

  @readonly @date('created_at') createdAt!: Date
}
