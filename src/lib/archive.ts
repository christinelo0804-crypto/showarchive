import JSZip from 'jszip'
import { db } from '../db/db'
import { seedIfEmpty } from '../db/seed'
import { createId, nowIso } from './id'
import type {
  Category,
  City,
  ImageAsset,
  Language,
  Show,
  ShowStatus,
  TicketChannel,
  Venue
} from '../types'

const FORMAT_VERSION = 1
const ARCHIVE_APP = 'ShowArchive'

export interface ExportedImageRef {
  thumbPath?: string
  displayPath?: string
  contentType: string
  width?: number
  height?: number
}

export interface ExportedShow {
  id: string
  title: string
  date: string
  time: string
  cityId: string
  venueId: string
  categoryLevel1Id: string
  categoryLevel2Id: string | null
  status: ShowStatus
  languageId?: string
  seat?: string
  cast?: string
  content?: string
  ticketChannelId?: string
  faceValue?: number
  paidPrice?: number
  rating?: number
  review?: string
  notes?: string
  poster?: ExportedImageRef
  ticketImage?: ExportedImageRef
  seatViewImage?: ExportedImageRef
  noteImages?: ExportedImageRef[]
  createdAt: string
  updatedAt: string
}

export interface ArchiveData {
  shows: ExportedShow[]
  categories: Category[]
  cities: City[]
  venues: Venue[]
  languages: Language[]
  ticketChannels: TicketChannel[]
  settings: Record<string, unknown>
}

export interface ArchiveManifest {
  formatVersion: number
  app: string
  exportedAt: string
  counts: { shows: number; media: number }
}

export interface MediaEntry {
  path: string
  blob: Blob
}

export interface ExportResult {
  data: ArchiveData
  media: MediaEntry[]
}

export interface ParsedArchive {
  manifest: ArchiveManifest
  data: ArchiveData
  zip: JSZip
}

function imageExt(contentType: string): string {
  return contentType === 'image/png' ? 'png' : 'jpg'
}

function collectAsset(
  asset: ImageAsset | undefined,
  basePath: string,
  entries: MediaEntry[]
): ExportedImageRef | undefined {
  if (!asset) return undefined
  const ref: ExportedImageRef = {
    contentType: asset.contentType,
    width: asset.width,
    height: asset.height
  }
  if (asset.thumbnail) {
    const path = `${basePath}-thumb.${imageExt(asset.contentType)}`
    entries.push({ path, blob: asset.thumbnail })
    ref.thumbPath = path
  }
  if (asset.display) {
    const path = `${basePath}-display.${imageExt(asset.contentType)}`
    entries.push({ path, blob: asset.display })
    ref.displayPath = path
  }
  return ref
}

function countMedia(shows: ExportedShow[]): number {
  return shows.reduce(
    (sum, s) =>
      sum +
      (s.poster ? 1 : 0) +
      (s.ticketImage ? 1 : 0) +
      (s.seatViewImage ? 1 : 0) +
      (s.noteImages?.length ?? 0),
    0
  )
}

/** 收集当前库中已发布（非草稿、非回收站）的全部数据，供导出使用。 */
export async function gatherExportData(): Promise<ExportResult> {
  const [shows, categories, cities, venues, languages, ticketChannels] = await Promise.all([
    db.shows.toArray(),
    db.categories.toArray(),
    db.cities.toArray(),
    db.venues.toArray(),
    db.languages.toArray(),
    db.ticketChannels.toArray()
  ])
  const media: MediaEntry[] = []
  const exportedShows: ExportedShow[] = []
  for (const show of shows) {
    if (show.deletedAt || show.isDraft) continue
    exportedShows.push({
      id: show.id,
      title: show.title,
      date: show.date,
      time: show.time,
      cityId: show.cityId,
      venueId: show.venueId,
      categoryLevel1Id: show.categoryLevel1Id,
      categoryLevel2Id: show.categoryLevel2Id,
      status: show.status,
      languageId: show.languageId,
      seat: show.seat,
      cast: show.cast,
      content: show.content,
      ticketChannelId: show.ticketChannelId,
      faceValue: show.faceValue,
      paidPrice: show.paidPrice,
      rating: show.rating,
      review: show.review,
      notes: show.notes,
      poster: collectAsset(show.poster, `media/${show.id}/poster`, media),
      ticketImage: collectAsset(show.ticketImage, `media/${show.id}/ticket`, media),
      seatViewImage: collectAsset(show.seatViewImage, `media/${show.id}/seat`, media),
      noteImages: (show.noteImages ?? [])
        .map((img, i) => collectAsset(img, `media/${show.id}/note-${i + 1}`, media))
        .filter((ref): ref is ExportedImageRef => ref != null),
      createdAt: show.createdAt,
      updatedAt: show.updatedAt
    })
  }
  return {
    data: { shows: exportedShows, categories, cities, venues, languages, ticketChannels, settings: {} },
    media
  }
}

export async function buildArchiveBlob(result: ExportResult): Promise<Blob> {
  const zip = new JSZip()
  const manifest: ArchiveManifest = {
    formatVersion: FORMAT_VERSION,
    app: ARCHIVE_APP,
    exportedAt: nowIso(),
    counts: { shows: result.data.shows.length, media: result.media.length }
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('data/shows.json', JSON.stringify(result.data.shows, null, 2))
  zip.file('data/categories.json', JSON.stringify(result.data.categories, null, 2))
  zip.file('data/cities.json', JSON.stringify(result.data.cities, null, 2))
  zip.file('data/venues.json', JSON.stringify(result.data.venues, null, 2))
  zip.file('data/languages.json', JSON.stringify(result.data.languages, null, 2))
  zip.file('data/ticketChannels.json', JSON.stringify(result.data.ticketChannels, null, 2))
  zip.file('data/settings.json', JSON.stringify(result.data.settings ?? {}, null, 2))
  for (const entry of result.media) zip.file(entry.path, entry.blob)
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function parseArchiveFile(file: Blob): Promise<ParsedArchive> {
  if (file instanceof File && file.size === 0) {
    throw new Error(`所选文件「${file.name}」内容为空（0 字节），请确认档案已完整保存到本机后重试`)
  }
  let zip: JSZip
  try {
    // iOS 26.5 的 WebKit 在 Service Worker 控制的页面中，直接读取磁盘文件
    // 可能返回空数据；先转为 ArrayBuffer 再解压，兼容性更好。
    const buffer = await file.arrayBuffer()
    if (buffer.byteLength === 0) throw new Error('empty-file')
    zip = await JSZip.loadAsync(buffer)
  } catch {
    const name = file instanceof File ? file.name : '未知文件'
    const size = file.size
    throw new Error(`无法读取文件「${name}」（${size} 字节），请确认选择的是 .showarchive 档案，且文件已完整下载到本机`)
  }
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('不是有效的 ShowArchive 档案（缺少 manifest.json）')
  let manifest: ArchiveManifest
  try {
    manifest = JSON.parse(await manifestFile.async('text')) as ArchiveManifest
  } catch {
    throw new Error('档案清单损坏，无法读取')
  }
  if (manifest.formatVersion == null) throw new Error('档案缺少格式版本号')
  if (manifest.formatVersion > FORMAT_VERSION) {
    throw new Error(`这份档案由更新版本创建（v${manifest.formatVersion}），请先升级 ShowArchive 再导入`)
  }
  async function readJson<T>(path: string, fallback: T): Promise<T> {
    const file = zip.file(path)
    if (!file) return fallback
    try {
      return JSON.parse(await file.async('text')) as T
    } catch {
      throw new Error(`档案中的 ${path} 损坏，无法读取`)
    }
  }
  const data: ArchiveData = {
    shows: await readJson<ExportedShow[]>('data/shows.json', []),
    categories: await readJson<Category[]>('data/categories.json', []),
    cities: await readJson<City[]>('data/cities.json', []),
    venues: await readJson<Venue[]>('data/venues.json', []),
    languages: await readJson<Language[]>('data/languages.json', []),
    ticketChannels: await readJson<TicketChannel[]>('data/ticketChannels.json', []),
    settings: await readJson<Record<string, unknown>>('data/settings.json', {})
  }
  return { manifest, data, zip }
}

function makeKey(title: string, date: string, time: string, venueName: string): string {
  return `${title.trim()}|${date}|${time}|${venueName.trim()}`
}

/** 合并导入前预览：按 标题+日期+时间+场馆 判断重复。 */
export async function previewMerge(data: ArchiveData): Promise<{ newCount: number; duplicateCount: number }> {
  const [existingShows, venues] = await Promise.all([db.shows.toArray(), db.venues.toArray()])
  const venueName = new Map(venues.map((v) => [v.id, v.name]))
  const existingKeys = new Set(
    existingShows.map((s) => makeKey(s.title, s.date, s.time, venueName.get(s.venueId) ?? ''))
  )
  const importedVenueName = new Map(data.venues.map((v) => [v.id, v.name]))
  const seen = new Set<string>()
  let newCount = 0
  let duplicateCount = 0
  for (const s of data.shows) {
    const key = makeKey(s.title, s.date, s.time, importedVenueName.get(s.venueId) ?? '')
    if (existingKeys.has(key) || seen.has(key)) {
      duplicateCount++
      continue
    }
    seen.add(key)
    newCount++
  }
  return { newCount, duplicateCount }
}

async function readAsset(zip: JSZip, ref: ExportedImageRef | undefined): Promise<ImageAsset | undefined> {
  if (!ref) return undefined
  const read = async (path?: string): Promise<Blob | undefined> => {
    if (!path) return undefined
    const file = zip.file(path)
    return file ? (await file.async('blob')) as Blob : undefined
  }
  const [thumbnail, display] = await Promise.all([read(ref.thumbPath), read(ref.displayPath)])
  if (!thumbnail && !display) return undefined
  return { thumbnail, display, contentType: ref.contentType, width: ref.width, height: ref.height }
}

async function exportedShowToShow(parsed: ParsedArchive, s: ExportedShow): Promise<Show> {
  const noteImages = await Promise.all((s.noteImages ?? []).map((r) => readAsset(parsed.zip, r)))
  const [poster, ticketImage, seatViewImage] = await Promise.all([
    readAsset(parsed.zip, s.poster),
    readAsset(parsed.zip, s.ticketImage),
    readAsset(parsed.zip, s.seatViewImage)
  ])
  return {
    id: s.id,
    title: s.title,
    date: s.date,
    time: s.time,
    cityId: s.cityId,
    venueId: s.venueId,
    categoryLevel1Id: s.categoryLevel1Id,
    categoryLevel2Id: s.categoryLevel2Id ?? null,
    status: s.status,
    isDraft: false,
    poster,
    ticketImage,
    seatViewImage,
    noteImages: noteImages.filter((a): a is ImageAsset => a != null),
    languageId: s.languageId,
    seat: s.seat,
    cast: s.cast,
    content: s.content,
    ticketChannelId: s.ticketChannelId,
    faceValue: s.faceValue,
    paidPrice: s.paidPrice,
    rating: s.rating,
    review: s.review,
    notes: s.notes,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt
  }
}

/** 替换导入：清空全部数据后写入档案内容（含设置）。 */
export async function importReplace(parsed: ParsedArchive): Promise<{ shows: number; media: number }> {
  const { data } = parsed
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
      await db.categories.bulkAdd(data.categories)
      await db.cities.bulkAdd(data.cities)
      await db.venues.bulkAdd(data.venues)
      await db.languages.bulkAdd(data.languages)
      await db.ticketChannels.bulkAdd(data.ticketChannels)
      for (const s of data.shows) {
        await db.shows.add(await exportedShowToShow(parsed, s))
      }
    }
  )
  if ((await db.categories.count()) === 0) await seedIfEmpty()
  return { shows: data.shows.length, media: countMedia(data.shows) }
}

async function mergeCities(data: City[]): Promise<Map<string, string>> {
  const existing = await db.cities.toArray()
  const map = new Map<string, string>()
  for (const city of data) {
    const hit = existing.find((e) => e.name === city.name)
    if (hit) {
      map.set(city.id, hit.id)
      continue
    }
    const id = createId()
    const now = nowIso()
    await db.cities.add({ id, name: city.name, createdAt: now, updatedAt: now })
    existing.push({ id, name: city.name, createdAt: now, updatedAt: now })
    map.set(city.id, id)
  }
  return map
}

async function mergeVenues(data: Venue[], cityMap: Map<string, string>): Promise<Map<string, string>> {
  const existing = await db.venues.toArray()
  const map = new Map<string, string>()
  for (const venue of data) {
    const cityId = cityMap.get(venue.cityId)
    if (!cityId) continue
    const hit = existing.find((e) => e.cityId === cityId && e.name === venue.name)
    if (hit) {
      map.set(venue.id, hit.id)
      continue
    }
    const id = createId()
    const now = nowIso()
    await db.venues.add({ id, name: venue.name, cityId, createdAt: now, updatedAt: now })
    existing.push({ id, name: venue.name, cityId, createdAt: now, updatedAt: now })
    map.set(venue.id, id)
  }
  return map
}

async function mergeCategories(data: Category[]): Promise<Map<string, string>> {
  const existing = await db.categories.toArray()
  const map = new Map<string, string>()
  const addCat = async (name: string, parentId: string | null): Promise<string> => {
    const id = createId()
    const now = nowIso()
    await db.categories.add({ id, name, parentId, sortOrder: 0, createdAt: now, updatedAt: now })
    existing.push({ id, name, parentId, sortOrder: 0, createdAt: now, updatedAt: now })
    return id
  }
  for (const c of data.filter((c) => !c.parentId)) {
    const hit = existing.find((e) => !e.parentId && e.name === c.name)
    map.set(c.id, hit ? hit.id : await addCat(c.name, null))
  }
  for (const c of data.filter((c) => c.parentId)) {
    if (!c.parentId) continue
    const parentId = map.get(c.parentId)
    if (!parentId) continue
    const hit = existing.find((e) => e.parentId === parentId && e.name === c.name)
    map.set(c.id, hit ? hit.id : await addCat(c.name, parentId))
  }
  return map
}

async function mergeByName(
  data: Array<{ id: string; name: string }>,
  table: 'languages' | 'ticketChannels'
): Promise<Map<string, string>> {
  const existing = await db[table].toArray()
  const map = new Map<string, string>()
  for (const item of data) {
    const hit = existing.find((e) => e.name === item.name)
    if (hit) {
      map.set(item.id, hit.id)
      continue
    }
    const id = createId()
    await db[table].add({ id, name: item.name })
    existing.push({ id, name: item.name })
    map.set(item.id, id)
  }
  return map
}

/** 合并导入：按名称合并基础数据，按 标题+日期+时间+场馆 跳过重复记录。 */
export async function importMerge(
  parsed: ParsedArchive
): Promise<{ added: number; skipped: number }> {
  const { data } = parsed
  let added = 0
  let skipped = 0
  await db.transaction(
    'rw',
    [db.shows, db.categories, db.cities, db.venues, db.languages, db.ticketChannels],
    async () => {
      const cityMap = await mergeCities(data.cities)
      const venueMap = await mergeVenues(data.venues, cityMap)
      const categoryMap = await mergeCategories(data.categories)
      const languageMap = await mergeByName(data.languages, 'languages')
      const channelMap = await mergeByName(data.ticketChannels, 'ticketChannels')

      const [existingShows, venues] = await Promise.all([db.shows.toArray(), db.venues.toArray()])
      const venueName = new Map(venues.map((v) => [v.id, v.name]))
      const existingKeys = new Set(
        existingShows.map((s) => makeKey(s.title, s.date, s.time, venueName.get(s.venueId) ?? ''))
      )
      const importedVenueName = new Map(data.venues.map((v) => [v.id, v.name]))
      const seen = new Set<string>()

      for (const s of data.shows) {
        const key = makeKey(s.title, s.date, s.time, importedVenueName.get(s.venueId) ?? '')
        if (existingKeys.has(key) || seen.has(key)) {
          skipped++
          continue
        }
        seen.add(key)
        const show = await exportedShowToShow(parsed, s)
        await db.shows.add({
          ...show,
          id: createId(),
          cityId: cityMap.get(s.cityId) ?? s.cityId,
          venueId: venueMap.get(s.venueId) ?? s.venueId,
          categoryLevel1Id: categoryMap.get(s.categoryLevel1Id) ?? s.categoryLevel1Id,
          categoryLevel2Id: s.categoryLevel2Id
            ? (categoryMap.get(s.categoryLevel2Id) ?? s.categoryLevel2Id)
            : null,
          languageId: s.languageId ? (languageMap.get(s.languageId) ?? s.languageId) : undefined,
          ticketChannelId: s.ticketChannelId
            ? (channelMap.get(s.ticketChannelId) ?? s.ticketChannelId)
            : undefined,
          updatedAt: nowIso()
        })
        added++
      }
    }
  )
  return { added, skipped }
}
