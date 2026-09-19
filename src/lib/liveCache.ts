import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  activeShows,
  draftShows,
  getDataOverview,
  listCategories,
  trashedShows
} from '../db/repositories'

/** 启动预取用的查询登记表：键名与各页面 useCachedLiveQuery 的键保持一致。 */
const PRELOAD = {
  'shows:active': () => activeShows(),
  'shows:drafts': () => draftShows(),
  'shows:trashed': () => trashedShows(),
  'shows:all': () => db.shows.toArray(),
  categories: () => db.categories.toArray(),
  'categories:list': () => listCategories(),
  cities: () => db.cities.toArray(),
  venues: () => db.venues.toArray(),
  languages: () => db.languages.toArray(),
  'ticket-channels': () => db.ticketChannels.toArray(),
  'data:overview': () => getDataOverview()
} as const

// 模块级结果缓存：页面重新挂载（例如从详情页返回）时首帧即可拿到上次的数据，
// 避免先闪一下「读取中…」再渲染内容；实时查询返回新结果后会自动覆盖。
const cache = new Map<string, unknown>()

export function useCachedLiveQuery<T>(key: string, querier: () => Promise<T>): T | undefined {
  const result = useLiveQuery(querier, [])
  if (result !== undefined) {
    cache.set(key, result)
    return result
  }
  return cache.get(key) as T | undefined
}

/** 启动后空闲时预取：把各页面要用的数据先读进缓存，避免首次进入页面时闪一下「读取中…」。 */
export function preloadLiveCache(): void {
  for (const [key, querier] of Object.entries(PRELOAD)) {
    void querier()
      .then((result) => {
        if (!cache.has(key)) cache.set(key, result)
      })
      .catch(() => {
        // 预取失败不影响正常使用
      })
  }
}
