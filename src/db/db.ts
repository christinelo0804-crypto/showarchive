import Dexie, { type EntityTable } from 'dexie'
import type { Category, City, Language, Show, TicketChannel, Venue } from '../types'
import { decodeShow, encodeShow, type StoredShow } from './imageCodec'

export const db = new Dexie('showarchive') as Dexie & {
  shows: EntityTable<Show, 'id'>
  categories: EntityTable<Category, 'id'>
  cities: EntityTable<City, 'id'>
  venues: EntityTable<Venue, 'id'>
  languages: EntityTable<Language, 'id'>
  ticketChannels: EntityTable<TicketChannel, 'id'>
}

db.version(1).stores({
  shows:
    'id, title, date, status, isDraft, cityId, venueId, categoryLevel1Id, categoryLevel2Id, languageId, ticketChannelId, deletedAt, createdAt',
  categories: 'id, parentId, sortOrder, name',
  cities: 'id, name, createdAt',
  venues: 'id, name, cityId, createdAt',
  languages: 'id, name',
  ticketChannels: 'id, name'
})

// 读取时把存储层 ArrayBuffer 图片转回 Blob，UI 层无感知。
db.shows.hook('reading', (obj) => decodeShow(obj as StoredShow))

/** 写入演出记录：图片 Blob 转 ArrayBuffer 后再入库（iOS Safari 兼容）。 */
export async function addShowEncoded(show: Show): Promise<string> {
  const stored = await encodeShow(show)
  return db.shows.add(stored as unknown as Show)
}

/** 更新演出记录：图片 Blob 转 ArrayBuffer 后再入库（iOS Safari 兼容）。 */
export async function putShowEncoded(show: Show): Promise<void> {
  const stored = await encodeShow(show)
  await db.shows.put(stored as unknown as Show)
}
