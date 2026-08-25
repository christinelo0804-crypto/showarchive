import { db } from './db'
import { createId, nowIso } from '../lib/id'
import type { Category } from '../types'
import { setCurrentVersion } from './defaultCategories'

const DEFAULT_CATEGORIES: Array<{
  key: string
  name: string
  children?: Array<{ key: string; name: string }>
}> = [
  {
    key: 'drama',
    name: '戏剧',
    children: [
      { key: 'musical', name: '音乐剧' },
      { key: 'play', name: '话剧' },
      { key: 'opera', name: '歌剧' },
      { key: 'dance', name: '舞剧' },
      { key: 'xiqu', name: '戏曲' },
      { key: 'immersive', name: '沉浸式' }
    ]
  },
  {
    key: 'concert',
    name: '演唱会',
    children: [
      { key: 'solo-concert', name: '专场演唱会' },
      { key: 'multi-act', name: '拼盘' },
      { key: 'festival', name: '音乐节' },
      { key: 'livehouse', name: 'Livehouse' }
    ]
  },
  {
    key: 'classical',
    name: '音乐会',
    children: [
      { key: 'symphony', name: '交响乐' },
      { key: 'chamber', name: '室内乐' },
      { key: 'folk', name: '民乐' },
      { key: 'solo', name: '独奏' },
      { key: 'vocal', name: '声乐' }
    ]
  },
  {
    key: 'spoken',
    name: '语言节目',
    children: [
      { key: 'standup', name: '脱口秀' },
      { key: 'xiangsheng', name: '相声' }
    ]
  },
  { key: 'sports', name: '体育比赛' }
]

let seedingPromise: Promise<void> | null = null

/**
 * 首次启动时写入默认一级 / 二级分类。
 * 带单次执行保护：开发模式下 StrictMode 会重复触发，两次并发检查都会读到空表，
 * 导致分类被插入两遍；这里用模块级 Promise 合并并发调用，完成后自动复位以便后续再次检查。
 */
export function seedIfEmpty(): Promise<void> {
  if (!seedingPromise) {
    seedingPromise = doSeed().finally(() => {
      seedingPromise = null
    })
  }
  return seedingPromise
}

async function doSeed(): Promise<void> {
  await dedupeCategories()
  const count = await db.categories.count()
  if (count > 0) return
  await db.transaction('rw', db.categories, async () => {
    // 事务内再查一次，避免跨事务的并发写入
    if ((await db.categories.count()) > 0) return
    for (const [i, group] of DEFAULT_CATEGORIES.entries()) {
      const now = nowIso()
      const parentId = createId()
      await db.categories.add({
        id: parentId,
        name: group.name,
        parentId: null,
        sortOrder: i + 1,
        defaultKey: group.key,
        createdAt: now,
        updatedAt: now
      })
      for (const [j, child] of (group.children ?? []).entries()) {
        await db.categories.add({
          id: createId(),
          name: child.name,
          parentId,
          sortOrder: j + 1,
          defaultKey: `${group.key}.${child.key}`,
          createdAt: now,
          updatedAt: now
        })
      }
    }
  })
  setCurrentVersion()
}

/**
 * 一次性去重：同名且同级的分类只保留最早一条，迁移演出记录与子分类后删除重复项。
 * 兼容已产生重复数据的设备（StrictMode 竞态的历史遗留）。
 */
async function dedupeCategories(): Promise<void> {
  // 一级分类去重
  const all = await db.categories.toArray()
  const level1 = all.filter((c) => !c.parentId)
  const groups = new Map<string, Category[]>()
  for (const c of level1) {
    const list = groups.get(c.name) ?? []
    list.push(c)
    groups.set(c.name, list)
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const keep = [...list].sort(compareCategory)[0]
    for (const dup of list.filter((c) => c.id !== keep.id)) {
      await db.transaction('rw', db.shows, db.categories, async () => {
        await db.categories.where('parentId').equals(dup.id).modify({ parentId: keep.id })
        const [asLevel1, asLevel2] = await Promise.all([
          db.shows.where('categoryLevel1Id').equals(dup.id).toArray(),
          db.shows.where('categoryLevel2Id').equals(dup.id).toArray()
        ])
        const now = nowIso()
        for (const s of asLevel1) {
          s.categoryLevel1Id = keep.id
          s.updatedAt = now
          await db.shows.put(s)
        }
        for (const s of asLevel2) {
          s.categoryLevel2Id = keep.id
          s.updatedAt = now
          await db.shows.put(s)
        }
        await db.categories.delete(dup.id)
      })
    }
  }

  // 二级分类去重（重新读取，避免一级迁移后快照过期）
  const after = await db.categories.toArray()
  const level2 = after.filter((c) => c.parentId)
  const groups2 = new Map<string, Category[]>()
  for (const c of level2) {
    const key = `${c.parentId}::${c.name}`
    const list = groups2.get(key) ?? []
    list.push(c)
    groups2.set(key, list)
  }
  for (const list of groups2.values()) {
    if (list.length < 2) continue
    const keep = [...list].sort(compareCategory)[0]
    for (const dup of list.filter((c) => c.id !== keep.id)) {
      await db.transaction('rw', db.shows, db.categories, async () => {
        const asLevel2 = await db.shows.where('categoryLevel2Id').equals(dup.id).toArray()
        const now = nowIso()
        for (const s of asLevel2) {
          s.categoryLevel2Id = keep.id
          s.updatedAt = now
          await db.shows.put(s)
        }
        await db.categories.delete(dup.id)
      })
    }
  }
}

function compareCategory(a: Category, b: Category): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  return a.id < b.id ? -1 : 1
}
