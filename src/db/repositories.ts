import { db } from './db'
import { createId, nowIso } from '../lib/id'
import type { Category, ImageAsset, Show } from '../types'

export interface ShowPayload {
  title: string
  date: string
  time: string
  cityId: string
  venueId: string
  categoryLevel1Id: string
  categoryLevel2Id: string | null
  status: Show['status']
  languageId?: string
  seat?: string
  cast?: string
  content?: string
  ticketChannelId?: string
  poster?: ImageAsset
  faceValue?: number
  paidPrice?: number
  rating?: number
  review?: string
  notes?: string
  ticketImage?: ImageAsset
  seatViewImage?: ImageAsset
  noteImages?: ImageAsset[]
}

export async function saveShow(input: ShowPayload, opts: { publish: boolean }): Promise<void> {
  const now = nowIso()
  await db.shows.add({
    id: createId(),
    title: input.title.trim(),
    date: input.date,
    time: input.time,
    cityId: input.cityId,
    venueId: input.venueId,
    categoryLevel1Id: input.categoryLevel1Id,
    categoryLevel2Id: input.categoryLevel2Id,
    status: input.status,
    isDraft: !opts.publish,
    languageId: input.languageId,
    seat: input.seat,
    cast: input.cast,
    content: input.content,
    ticketChannelId: input.ticketChannelId,
    poster: input.poster,
    faceValue: input.faceValue,
    paidPrice: input.paidPrice,
    rating: input.rating,
    review: input.review,
    notes: input.notes,
    ticketImage: input.ticketImage,
    seatViewImage: input.seatViewImage,
    noteImages: input.noteImages,
    createdAt: now,
    updatedAt: now
  })
}

export async function updateShow(id: string, input: ShowPayload, opts: { publish: boolean }): Promise<void> {
  const existing = await db.shows.get(id)
  if (!existing) throw new Error('记录不存在或已删除')
  await db.shows.put({
    ...existing,
    title: input.title.trim(),
    date: input.date,
    time: input.time,
    cityId: input.cityId,
    venueId: input.venueId,
    categoryLevel1Id: input.categoryLevel1Id,
    categoryLevel2Id: input.categoryLevel2Id,
    status: input.status,
    isDraft: !opts.publish,
    languageId: input.languageId,
    seat: input.seat,
    cast: input.cast,
    content: input.content,
    ticketChannelId: input.ticketChannelId,
    faceValue: input.faceValue,
    paidPrice: input.paidPrice,
    rating: input.rating,
    review: input.review,
    notes: input.notes,
    poster: input.poster,
    ticketImage: input.ticketImage,
    seatViewImage: input.seatViewImage,
    noteImages: input.noteImages,
    updatedAt: nowIso()
  })
}

export async function activeShows(): Promise<Show[]> {
  const all = await db.shows.toArray()
  return all
    .filter((s) => !s.deletedAt && !s.isDraft)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export async function draftShows(): Promise<Show[]> {
  const all = await db.shows.toArray()
  return all.filter((s) => !s.deletedAt && s.isDraft).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export async function trashedShows(): Promise<Show[]> {
  const all = await db.shows.toArray()
  return all.filter((s) => s.deletedAt).sort((a, b) => (a.deletedAt! < b.deletedAt! ? 1 : -1))
}

export async function softDeleteShow(id: string): Promise<void> {
  await db.shows.update(id, { deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreShow(id: string): Promise<void> {
  await db.shows.update(id, { deletedAt: undefined, updatedAt: nowIso() })
}

export async function purgeShow(id: string): Promise<void> {
  await db.shows.delete(id)
}

export async function emptyTrash(): Promise<void> {
  const trashed = await trashedShows()
  await db.shows.bulkDelete(trashed.map((s) => s.id))
}

/** 删除本设备全部数据（不包含设置表，V1 暂无设置表）。 */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.shows, db.categories, db.cities, db.venues, db.languages, db.ticketChannels],
    async () => {
      await Promise.all([
        db.shows.clear(),
        db.categories.clear(),
        db.cities.clear(),
        db.venues.clear(),
        db.languages.clear(),
        db.ticketChannels.clear()
      ])
    }
  )
}

export async function listCategories(): Promise<Category[]> {
  return db.categories.toArray()
}

export async function addCategory(name: string, parentId: string | null): Promise<string> {
  const now = nowIso()
  const all = await db.categories.toArray()
  const maxOrder = all
    .filter((c) => c.parentId === parentId)
    .reduce((max, c) => Math.max(max, c.sortOrder), 0)
  const id = createId()
  await db.categories.add({
    id,
    name: name.trim(),
    parentId,
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now
  })
  return id
}

/** 上移 / 下移分类：在同级内交换位置，并把该层级顺序归一化为 1..n。 */
export async function moveCategory(id: string, direction: -1 | 1): Promise<void> {
  const category = await db.categories.get(id)
  if (!category) throw new Error('分类不存在')
  const all = await db.categories.toArray()
  const siblings = all
    .filter((c) => c.parentId === category.parentId)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN')
    )
  const index = siblings.findIndex((c) => c.id === id)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
    throw new Error('已在最前 / 最后')
  }
  const order = siblings.map((c) => c.id)
  ;[order[index], order[targetIndex]] = [order[targetIndex], order[index]]
  await db.transaction('rw', db.categories, async () => {
    for (let i = 0; i < order.length; i++) {
      await db.categories.update(order[i], { sortOrder: i + 1, updatedAt: nowIso() })
    }
  })
}

export async function updateCategory(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('名称不能为空')
  const category = await db.categories.get(id)
  if (!category) throw new Error('分类不存在')
  const duplicate = await db.categories
    .where('name')
    .equals(trimmed)
    .filter((c) => c.parentId === category.parentId && c.id !== id)
    .first()
  if (duplicate) throw new Error('已存在同名分类')
  await db.categories.update(id, { name: trimmed, userModified: true, updatedAt: nowIso() })
}

/** 迁移分类下的演出记录到目标分类（来源保留）。仅允许同层迁移。 */
export async function migrateCategoryRecords(sourceId: string, targetId: string): Promise<number> {
  const source = await db.categories.get(sourceId)
  const target = await db.categories.get(targetId)
  if (!source || !target) throw new Error('分类不存在')
  if (source.id === target.id) throw new Error('来源与目标不能相同')
  if (source.parentId !== target.parentId) throw new Error('只能迁移到同一层级的分类')

  let affected = 0
  await db.transaction('rw', db.shows, async () => {
    const [asLevel1, asLevel2] = await Promise.all([
      db.shows.where('categoryLevel1Id').equals(sourceId).toArray(),
      db.shows.where('categoryLevel2Id').equals(sourceId).toArray()
    ])
    const now = nowIso()
    for (const show of asLevel1) {
      show.categoryLevel1Id = targetId
      show.updatedAt = now
      await db.shows.put(show)
    }
    for (const show of asLevel2) {
      show.categoryLevel2Id = targetId
      show.updatedAt = now
      await db.shows.put(show)
    }
    affected = asLevel1.length + asLevel2.length
  })
  return affected
}

/** 删除分类：有记录时先迁移到 migrateTargetId 再删除；有子分类时禁止删除。 */
export async function deleteCategory(id: string, migrateTargetId?: string): Promise<number> {
  const category = await db.categories.get(id)
  if (!category) throw new Error('分类不存在')
  let migrated = 0
  await db.transaction('rw', db.shows, db.categories, async () => {
    const children = await db.categories.where('parentId').equals(id).count()
    if (children > 0) throw new Error('该分类下还有子分类，请先处理子分类')
    if (migrateTargetId) {
      const target = await db.categories.get(migrateTargetId)
      if (!target) throw new Error('目标分类不存在')
      if (target.parentId !== category.parentId) throw new Error('只能迁移到同一层级的分类')
      const [asLevel1, asLevel2] = await Promise.all([
        db.shows.where('categoryLevel1Id').equals(id).toArray(),
        db.shows.where('categoryLevel2Id').equals(id).toArray()
      ])
      const now = nowIso()
      for (const show of asLevel1) {
        show.categoryLevel1Id = migrateTargetId
        show.updatedAt = now
        await db.shows.put(show)
      }
      for (const show of asLevel2) {
        show.categoryLevel2Id = migrateTargetId
        show.updatedAt = now
        await db.shows.put(show)
      }
      migrated = asLevel1.length + asLevel2.length
    }
    const remaining =
      (await db.shows.where('categoryLevel1Id').equals(id).count()) +
      (await db.shows.where('categoryLevel2Id').equals(id).count())
    if (remaining > 0) throw new Error('该分类下仍有演出记录，请先迁移')
    await db.categories.delete(id)
  })
  return migrated
}

export async function updateCity(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('名称不能为空')
  const city = await db.cities.get(id)
  if (!city) throw new Error('城市不存在')
  const duplicate = await db.cities.where('name').equals(trimmed).filter((c) => c.id !== id).first()
  if (duplicate) throw new Error('已存在同名城市')
  await db.cities.update(id, { name: trimmed, updatedAt: nowIso() })
}

/** 迁移城市下的演出记录与场馆到目标城市（来源保留）。 */
export async function migrateCity(
  sourceId: string,
  targetId: string
): Promise<{ shows: number; venues: number }> {
  const source = await db.cities.get(sourceId)
  const target = await db.cities.get(targetId)
  if (!source || !target) throw new Error('城市不存在')
  if (source.id === target.id) throw new Error('来源与目标不能相同')

  let shows = 0
  let venues = 0
  await db.transaction('rw', db.shows, db.venues, async () => {
    const showList = await db.shows.where('cityId').equals(sourceId).toArray()
    const venueList = await db.venues.where('cityId').equals(sourceId).toArray()
    const now = nowIso()
    for (const show of showList) {
      show.cityId = targetId
      show.updatedAt = now
      await db.shows.put(show)
    }
    for (const venue of venueList) {
      venue.cityId = targetId
      venue.updatedAt = now
      await db.venues.put(venue)
    }
    shows = showList.length
    venues = venueList.length
  })
  return { shows, venues }
}

/** 删除城市：有记录或场馆时先迁移到 migrateTargetId 再删除。 */
export async function deleteCity(
  id: string,
  migrateTargetId?: string
): Promise<{ shows: number; venues: number }> {
  const city = await db.cities.get(id)
  if (!city) throw new Error('城市不存在')
  let shows = 0
  let venues = 0
  await db.transaction('rw', db.shows, db.venues, db.cities, async () => {
    if (migrateTargetId) {
      const showList = await db.shows.where('cityId').equals(id).toArray()
      const venueList = await db.venues.where('cityId').equals(id).toArray()
      const now = nowIso()
      for (const show of showList) {
        show.cityId = migrateTargetId
        show.updatedAt = now
        await db.shows.put(show)
      }
      for (const venue of venueList) {
        venue.cityId = migrateTargetId
        venue.updatedAt = now
        await db.venues.put(venue)
      }
      shows = showList.length
      venues = venueList.length
    }
    const remainingShows = await db.shows.where('cityId').equals(id).count()
    const remainingVenues = await db.venues.where('cityId').equals(id).count()
    if (remainingShows > 0 || remainingVenues > 0) throw new Error('该城市下仍有记录或场馆，请先迁移')
    await db.cities.delete(id)
  })
  return { shows, venues }
}

export async function updateVenue(id: string, name: string, cityId: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('名称不能为空')
  const venue = await db.venues.get(id)
  if (!venue) throw new Error('场馆不存在')
  const duplicate = await db.venues
    .where('name')
    .equals(trimmed)
    .filter((v) => v.cityId === cityId && v.id !== id)
    .first()
  if (duplicate) throw new Error('该城市下已存在同名场馆')
  await db.venues.update(id, { name: trimmed, cityId, updatedAt: nowIso() })
}

/** 迁移场馆下的演出记录到目标场馆（来源保留）。 */
export async function migrateVenue(sourceId: string, targetId: string): Promise<number> {
  const source = await db.venues.get(sourceId)
  const target = await db.venues.get(targetId)
  if (!source || !target) throw new Error('场馆不存在')
  if (source.id === target.id) throw new Error('来源与目标不能相同')

  let affected = 0
  await db.transaction('rw', db.shows, async () => {
    const list = await db.shows.where('venueId').equals(sourceId).toArray()
    const now = nowIso()
    for (const show of list) {
      show.venueId = targetId
      show.updatedAt = now
      await db.shows.put(show)
    }
    affected = list.length
  })
  return affected
}

/** 删除场馆：有记录时先迁移到 migrateTargetId 再删除。 */
export async function deleteVenue(id: string, migrateTargetId?: string): Promise<number> {
  const venue = await db.venues.get(id)
  if (!venue) throw new Error('场馆不存在')
  let migrated = 0
  await db.transaction('rw', db.shows, db.venues, async () => {
    if (migrateTargetId) {
      const list = await db.shows.where('venueId').equals(id).toArray()
      const now = nowIso()
      for (const show of list) {
        show.venueId = migrateTargetId
        show.updatedAt = now
        await db.shows.put(show)
      }
      migrated = list.length
    }
    const remaining = await db.shows.where('venueId').equals(id).count()
    if (remaining > 0) throw new Error('该场馆下仍有演出记录，请先迁移')
    await db.venues.delete(id)
  })
  return migrated
}

export async function ensureCity(name: string): Promise<string> {
  const trimmed = name.trim()
  const existing = await db.cities.where('name').equals(trimmed).first()
  if (existing) return existing.id
  const now = nowIso()
  const id = createId()
  await db.cities.add({ id, name: trimmed, createdAt: now, updatedAt: now })
  return id
}

export async function ensureVenue(name: string, cityId: string): Promise<string> {
  const trimmed = name.trim()
  const existing = await db.venues.where('name').equals(trimmed).and((v) => v.cityId === cityId).first()
  if (existing) return existing.id
  const now = nowIso()
  const id = createId()
  await db.venues.add({ id, name: trimmed, cityId, createdAt: now, updatedAt: now })
  return id
}

export async function ensureLanguage(name: string): Promise<string> {
  const trimmed = name.trim()
  const existing = await db.languages.where('name').equals(trimmed).first()
  if (existing) return existing.id
  const id = createId()
  await db.languages.add({ id, name: trimmed })
  return id
}

export async function updateLanguage(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('名称不能为空')
  const language = await db.languages.get(id)
  if (!language) throw new Error('语言不存在')
  const duplicate = await db.languages
    .where('name')
    .equals(trimmed)
    .filter((l) => l.id !== id)
    .first()
  if (duplicate) throw new Error('已存在同名语言')
  await db.languages.update(id, { name: trimmed })
}

/** 迁移语言下的演出记录到目标语言（来源保留）。 */
export async function migrateLanguageRecords(sourceId: string, targetId: string): Promise<number> {
  const source = await db.languages.get(sourceId)
  const target = await db.languages.get(targetId)
  if (!source || !target) throw new Error('语言不存在')
  if (source.id === target.id) throw new Error('来源与目标不能相同')

  let affected = 0
  await db.transaction('rw', db.shows, async () => {
    const list = await db.shows.where('languageId').equals(sourceId).toArray()
    const now = nowIso()
    for (const show of list) {
      show.languageId = targetId
      show.updatedAt = now
      await db.shows.put(show)
    }
    affected = list.length
  })
  return affected
}

/** 删除语言：有记录时先迁移到 migrateTargetId 再删除。 */
export async function deleteLanguage(id: string, migrateTargetId?: string): Promise<number> {
  const language = await db.languages.get(id)
  if (!language) throw new Error('语言不存在')
  let migrated = 0
  await db.transaction('rw', db.shows, db.languages, async () => {
    if (migrateTargetId) {
      const list = await db.shows.where('languageId').equals(id).toArray()
      const now = nowIso()
      for (const show of list) {
        show.languageId = migrateTargetId
        show.updatedAt = now
        await db.shows.put(show)
      }
      migrated = list.length
    }
    const remaining = await db.shows.where('languageId').equals(id).count()
    if (remaining > 0) throw new Error('该语言下仍有演出记录，请先迁移')
    await db.languages.delete(id)
  })
  return migrated
}

export async function ensureTicketChannel(name: string): Promise<string> {
  const trimmed = name.trim()
  const existing = await db.ticketChannels.where('name').equals(trimmed).first()
  if (existing) return existing.id
  const id = createId()
  await db.ticketChannels.add({ id, name: trimmed })
  return id
}

export async function updateTicketChannel(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('名称不能为空')
  const channel = await db.ticketChannels.get(id)
  if (!channel) throw new Error('购票渠道不存在')
  const duplicate = await db.ticketChannels
    .where('name')
    .equals(trimmed)
    .filter((c) => c.id !== id)
    .first()
  if (duplicate) throw new Error('已存在同名购票渠道')
  await db.ticketChannels.update(id, { name: trimmed })
}

/** 迁移购票渠道下的演出记录到目标渠道（来源保留）。 */
export async function migrateTicketChannelRecords(
  sourceId: string,
  targetId: string
): Promise<number> {
  const source = await db.ticketChannels.get(sourceId)
  const target = await db.ticketChannels.get(targetId)
  if (!source || !target) throw new Error('购票渠道不存在')
  if (source.id === target.id) throw new Error('来源与目标不能相同')

  let affected = 0
  await db.transaction('rw', db.shows, async () => {
    const list = await db.shows.where('ticketChannelId').equals(sourceId).toArray()
    const now = nowIso()
    for (const show of list) {
      show.ticketChannelId = targetId
      show.updatedAt = now
      await db.shows.put(show)
    }
    affected = list.length
  })
  return affected
}

/** 删除购票渠道：有记录时先迁移到 migrateTargetId 再删除。 */
export async function deleteTicketChannel(id: string, migrateTargetId?: string): Promise<number> {
  const channel = await db.ticketChannels.get(id)
  if (!channel) throw new Error('购票渠道不存在')
  let migrated = 0
  await db.transaction('rw', db.shows, db.ticketChannels, async () => {
    if (migrateTargetId) {
      const list = await db.shows.where('ticketChannelId').equals(id).toArray()
      const now = nowIso()
      for (const show of list) {
        show.ticketChannelId = migrateTargetId
        show.updatedAt = now
        await db.shows.put(show)
      }
      migrated = list.length
    }
    const remaining = await db.shows.where('ticketChannelId').equals(id).count()
    if (remaining > 0) throw new Error('该购票渠道下仍有演出记录，请先迁移')
    await db.ticketChannels.delete(id)
  })
  return migrated
}

export async function getDataOverview(): Promise<{
  shows: number
  drafts: number
  trashed: number
  images: number
  cities: number
  venues: number
}> {
  const all = await db.shows.toArray()
  const active = all.filter((s) => !s.deletedAt && !s.isDraft)
  const drafts = all.filter((s) => !s.deletedAt && s.isDraft)
  const trashed = all.filter((s) => s.deletedAt)
  const images = all.reduce(
    (sum, s) =>
      sum +
      (s.poster ? 1 : 0) +
      (s.ticketImage ? 1 : 0) +
      (s.seatViewImage ? 1 : 0) +
      (s.noteImages?.length ?? 0),
    0
  )
  return {
    shows: active.length,
    drafts: drafts.length,
    trashed: trashed.length,
    images,
    cities: await db.cities.count(),
    venues: await db.venues.count()
  }
}
