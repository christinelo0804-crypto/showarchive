import { db } from './db'
import { createId, nowIso } from '../lib/id'
import type { Category } from '../types'

/** 代码当前默认分类版本号；每次改默认分类时 +1 并追加 MIGRATIONS */
const DEFAULT_CATEGORY_VERSION = 2

const VERSION_KEY = 'showarchive-default-cat-version'
const DECLINED_KEY = 'showarchive-declined-default-removals'

type MigrationOp =
  | { type: 'addGroup'; name: string; children?: string[] }
  | { type: 'addChild'; level1: string; child: string; after?: string }
  | { type: 'rename'; level1?: string; from: string; to: string }
  | { type: 'remove'; level1?: string; name: string }
  | { type: 'reorderChildren'; level1: string; order: string[] }

interface DefaultCategoryMigration {
  version: number
  ops: MigrationOp[]
}

/**
 * 迁移清单：按版本号顺序执行，只对旧版本设备生效。
 * 命名类操作按「一级分类名 + 名称」匹配，用户改过名（userModified）的项会被跳过。
 */
const MIGRATIONS: DefaultCategoryMigration[] = [
  {
    version: 2,
    ops: [
      { type: 'rename', level1: '演唱会', from: '专场', to: '专场演唱会' },
      { type: 'addChild', level1: '音乐会', child: '室内乐', after: '交响乐' }
    ]
  }
]

export interface MigrationPlan {
  added: string[]
  renamed: Array<{ from: string; to: string }>
  reordered: string[]
  pendingRemovals: Array<{ key: string; name: string }>
  hasChanges: boolean
}

function readNumber(key: string): number {
  const n = Number(localStorage.getItem(key))
  return Number.isFinite(n) ? n : 0
}

function getStoredVersion(): number {
  return readNumber(VERSION_KEY)
}

export function setCurrentVersion(): void {
  try {
    localStorage.setItem(VERSION_KEY, String(DEFAULT_CATEGORY_VERSION))
  } catch {
    // 存储不可用时忽略；下次启动会重新尝试
  }
}

function loadDeclined(): string[] {
  try {
    const raw = localStorage.getItem(DECLINED_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function storeDeclined(keys: string[]): void {
  try {
    localStorage.setItem(DECLINED_KEY, JSON.stringify([...new Set(keys)]))
  } catch {
    // 忽略存储失败
  }
}

const removeKey = (level1: string | undefined, name: string) => `${level1 ?? '(top)'}:${name}`

/**
 * 检查版本并规划迁移：非删除类操作立即执行（幂等），
 * 删除类操作收集起来等待用户确认（finalizeDefaultCategoryMigrations 里执行）。
 * 版本号已是最新时返回 null。
 */
export async function planDefaultCategoryMigrations(): Promise<MigrationPlan | null> {
  const stored = getStoredVersion()
  if (stored >= DEFAULT_CATEGORY_VERSION) return null

  const declined = loadDeclined()
  const all = await db.categories.toArray()
  const added: string[] = []
  const renamed: Array<{ from: string; to: string }> = []
  const reordered: string[] = []
  const pendingRemovals: Array<{ key: string; name: string }> = []

  const level1ByName = (name: string) => all.find((c) => !c.parentId && c.name === name)
  const childByName = (parent: Category, name: string) =>
    all.find((c) => c.parentId === parent.id && c.name === name)

  async function refsOf(item: Category): Promise<number> {
    if (!item.parentId) {
      const withChildren = all.some((c) => c.parentId === item.id)
      if (withChildren) return Number.MAX_SAFE_INTEGER
      return db.shows.where('categoryLevel1Id').equals(item.id).count()
    }
    return db.shows.where('categoryLevel2Id').equals(item.id).count()
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= stored) continue
    for (const op of migration.ops) {
      if (op.type === 'addGroup') {
        if (!level1ByName(op.name)) {
          const parentId = createId()
          await db.categories.add({
            id: parentId,
            name: op.name,
            parentId: null,
            sortOrder: all.filter((c) => !c.parentId).length + 1,
            createdAt: nowIso(),
            updatedAt: nowIso()
          })
          for (const [j, child] of (op.children ?? []).entries()) {
            const childId = createId()
            await db.categories.add({
              id: childId,
              name: child,
              parentId,
              sortOrder: j + 1,
              createdAt: nowIso(),
              updatedAt: nowIso()
            })
          }
          added.push(op.name)
          const fresh = await db.categories.toArray()
          all.splice(0, all.length, ...fresh)
        }
      } else if (op.type === 'addChild') {
        const parent = level1ByName(op.level1)
        if (parent && !childByName(parent, op.child)) {
          const siblings = all.filter((c) => c.parentId === parent.id)
          const insertAt = op.after ? siblings.findIndex((s) => s.name === op.after) : -1
          const position = insertAt >= 0 ? insertAt + 1 : siblings.length
          await db.transaction('rw', db.categories, async () => {
            for (const sib of siblings) {
              if (sib.sortOrder >= position) {
                await db.categories.update(sib.id, { sortOrder: sib.sortOrder + 1, updatedAt: nowIso() })
              }
            }
            await db.categories.add({
              id: createId(),
              name: op.child,
              parentId: parent.id,
              sortOrder: position,
              createdAt: nowIso(),
              updatedAt: nowIso()
            })
          })
          added.push(`${op.level1} / ${op.child}`)
          const fresh = await db.categories.toArray()
          all.splice(0, all.length, ...fresh)
        }
      } else if (op.type === 'rename') {
        const item = op.level1 ? childByName(level1ByName(op.level1)!, op.from) : level1ByName(op.from)
        if (item && !item.userModified && item.name !== op.to) {
          const from = item.name
          await db.categories.update(item.id, { name: op.to, updatedAt: nowIso() })
          item.name = op.to
          renamed.push({ from, to: op.to })
        }
      } else if (op.type === 'remove') {
        const item = op.level1 ? childByName(level1ByName(op.level1)!, op.name) : level1ByName(op.name)
        if (!item || item.userModified) continue
        const key = removeKey(op.level1, op.name)
        if (declined.includes(key)) continue
        if ((await refsOf(item)) > 0) continue
        pendingRemovals.push({ key, name: op.level1 ? `${op.level1} / ${op.name}` : op.name })
      } else if (op.type === 'reorderChildren') {
        const parent = level1ByName(op.level1)
        if (!parent) continue
        const children = all.filter((c) => c.parentId === parent.id)
        const ordered = op.order
          .map((name) => children.find((c) => c.name === name))
          .filter((c): c is Category => Boolean(c))
        const rest = children.filter((c) => !op.order.includes(c.name))
        const list = [...ordered, ...rest]
        if (list.length === children.length) {
          let changed = false
          for (let i = 0; i < list.length; i++) {
            if (list[i].sortOrder !== i + 1) {
              await db.categories.update(list[i].id, { sortOrder: i + 1, updatedAt: nowIso() })
              list[i].sortOrder = i + 1
              changed = true
            }
          }
          if (changed) reordered.push(parent.name)
        }
      }
    }
  }

  return {
    added,
    renamed,
    reordered,
    pendingRemovals,
    hasChanges: added.length > 0 || renamed.length > 0 || reordered.length > 0 || pendingRemovals.length > 0
  }
}

/**
 * 用户对删除类操作做出决定后调用：
 * acceptedKeys 将被删除；declinedKeys 记入「不再询问」；随后推进版本号。
 */
export async function finalizeDefaultCategoryMigrations(
  acceptedKeys: string[],
  declinedKeys: string[]
): Promise<void> {
  if (acceptedKeys.length > 0) {
    const all = await db.categories.toArray()
    for (const key of acceptedKeys) {
      const sep = key.indexOf(':')
      const level1 = key.slice(0, sep)
      const name = key.slice(sep + 1)
      let item: Category | undefined
      if (level1 === '(top)') {
        item = all.find((c) => !c.parentId && c.name === name)
      } else {
        const parent = all.find((c) => !c.parentId && c.name === level1)
        item = parent ? all.find((c) => c.parentId === parent.id && c.name === name) : undefined
      }
      if (item) await db.categories.delete(item.id)
    }
  }
  const merged = [...new Set([...loadDeclined(), ...declinedKeys])]
  storeDeclined(merged)
  setCurrentVersion()
}
