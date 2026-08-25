import Dexie, { type EntityTable } from 'dexie'
import type { Category, City, Language, Show, TicketChannel, Venue } from '../types'

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
