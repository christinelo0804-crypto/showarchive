import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  addCategory,
  deleteCategory,
  listCategories,
  migrateCategoryRecords,
  moveCategory,
  updateCategory
} from '../db/repositories'
import { Button, EmptyState, MoreMenu, PageHeader, SectionTitle } from '../components/ui'
import { Modal } from '../components/Modal'
import { Select } from '../components/Select'
import { useToast } from '../components/Toast'
import type { Category } from '../types'

function compareCategory(a: Category, b: Category): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN')
}

export default function CategoryManagePage() {
  const toast = useToast()
  const categories = useLiveQuery(() => listCategories(), [])
  const shows = useLiveQuery(() => db.shows.toArray(), [])

  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')
  const [migrateTarget, setMigrateTarget] = useState<Category | null>(null)
  const [migrateToId, setMigrateToId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteToId, setDeleteToId] = useState('')

  const level1 = (categories ?? []).filter((c) => !c.parentId).sort(compareCategory)
  const childrenOf = (id: string) =>
    (categories ?? []).filter((c) => c.parentId === id).sort(compareCategory)
  // 一次遍历建立「分类 → 演出数量」映射，避免每次渲染都重复遍历全部演出
  const countMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of shows ?? []) {
      for (const id of [s.categoryLevel1Id, s.categoryLevel2Id]) {
        if (!id) continue
        map.set(id, (map.get(id) ?? 0) + 1)
      }
    }
    return map
  }, [shows])
  const countOf = (id: string) => countMap.get(id) ?? 0
  const childCountOf = (id: string) => childrenOf(id).length

  function targetOptions(c: Category): Category[] {
    return (categories ?? []).filter((x) => x.id !== c.id && x.parentId === c.parentId).sort(compareCategory)
  }

  async function handleAdd() {
    if (!name.trim()) {
      toast.push('error', '请输入分类名称')
      return
    }
    await addCategory(name, parentId || null)
    setName('')
    setParentId('')
    toast.push('success', '分类已添加')
  }

  async function handleEditSave() {
    if (!editTarget) return
    setBusy(true)
    try {
      await updateCategory(editTarget.id, editName)
      toast.push('success', '分类已更新')
      setEditTarget(null)
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : '更新失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleMigrate() {
    if (!migrateTarget || !migrateToId) return
    setBusy(true)
    try {
      const count = await migrateCategoryRecords(migrateTarget.id, migrateToId)
      toast.push('success', `已迁移 ${count} 条记录`)
      setMigrateTarget(null)
      setMigrateToId('')
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : '迁移失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      const migrated = await deleteCategory(deleteTarget.id, deleteToId || undefined)
      toast.push(
        'success',
        deleteToId ? `已迁移 ${migrated} 条记录并删除分类` : '分类已删除'
      )
      setDeleteTarget(null)
      setDeleteToId('')
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleMove(id: string, direction: -1 | 1) {
    try {
      await moveCategory(id, direction)
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : '调整顺序失败')
    }
  }

  const migrateCount = migrateTarget ? countOf(migrateTarget.id) : 0
  const deleteCount = deleteTarget ? countOf(deleteTarget.id) : 0
  const deleteChildren = deleteTarget ? childCountOf(deleteTarget.id) : 0
  const migrateTargets = migrateTarget ? targetOptions(migrateTarget) : []
  const deleteTargets = deleteTarget ? targetOptions(deleteTarget) : []
  const migrateHasTarget = migrateTargets.length > 0
  const deleteHasTarget = deleteTargets.length > 0

  function focusAdd() {
    const input = document.getElementById('cat-name')
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    input?.focus()
  }

  const q = query.trim().toLowerCase()
  const visibleGroups = level1
    .map((group) => {
      const groupMatch = !q || group.name.toLowerCase().includes(q)
      const children = childrenOf(group.id).filter(
        (c) => !q || c.name.toLowerCase().includes(q) || group.name.toLowerCase().includes(q)
      )
      return { group, children, show: groupMatch || children.length > 0 }
    })
    .filter((x) => x.show)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Categories"
        title="演出分类管理"
        back
      />

      <section className="form-section">
        <SectionTitle kicker="New">新增分类</SectionTitle>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="cat-name">名称</label>
            <input
              id="cat-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：芭蕾舞"
            />
          </div>
          <div className="field">
            <label htmlFor="cat-parent">归属</label>
            <Select
              value={parentId}
              onChange={setParentId}
              options={[
                { value: '', label: '作为一级分类' },
                ...level1.map((c) => ({ value: c.id, label: `作为「${c.name}」的二级分类` }))
              ]}
              ariaLabel="归属"
            />
          </div>
        </div>
        <Button type="button" onClick={() => void handleAdd()}>
          添加分类
        </Button>
      </section>

      <section className="form-section">
        <SectionTitle kicker="Categories">当前分类</SectionTitle>
        <input
          className="input list-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索分类…"
        />
        {visibleGroups.length === 0 ? (
          level1.length === 0 ? (
            <EmptyState title="还没有分类" hint="先添加一级分类，再在它下面建二级分类。">
              <Button type="button" onClick={focusAdd}>
                添加分类
              </Button>
            </EmptyState>
          ) : (
            <EmptyState title="没有匹配的分类" hint="换个关键词试试。" />
          )
        ) : (
          visibleGroups.map(({ group, children }) => {
            const expanded = q ? true : !collapsed[group.id]
            const groupIndex = level1.indexOf(group)
            return (
              <div key={group.id} className="manage-group">
                <div
                  className="group-head"
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [group.id]: !collapsed[group.id] }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setCollapsed((c) => ({ ...c, [group.id]: !collapsed[group.id] }))
                    }
                  }}
                >
                  <span className="chevron">{expanded ? '▾' : '▸'}</span>
                  <span className="name">{group.name}</span>
                  <span className="count">{countOf(group.id)} 场</span>
                  <MoreMenu
                    onMoveUp={() => void handleMove(group.id, -1)}
                    onMoveDown={() => void handleMove(group.id, 1)}
                    canMoveUp={groupIndex > 0}
                    canMoveDown={groupIndex < level1.length - 1}
                    onEdit={() => {
                      setEditTarget(group)
                      setEditName(group.name)
                    }}
                    onMigrate={() => {
                      setMigrateTarget(group)
                      setMigrateToId('')
                    }}
                    onDelete={() => {
                      setDeleteTarget(group)
                      setDeleteToId('')
                    }}
                  />
                </div>
                {expanded && (
                  <div className="group-children">
                    {children.length === 0 ? (
                      <div className="item-row">
                        <span className="name muted-text">暂无二级分类</span>
                      </div>
                    ) : (
                      children.map((child) => {
                        const childIndex = children.indexOf(child)
                        return (
                          <div key={child.id} className="item-row">
                            <span className="name">{child.name}</span>
                            <span className="count">{countOf(child.id)} 场</span>
                            <MoreMenu
                              onMoveUp={() => void handleMove(child.id, -1)}
                              onMoveDown={() => void handleMove(child.id, 1)}
                              canMoveUp={childIndex > 0}
                              canMoveDown={childIndex < children.length - 1}
                              onEdit={() => {
                                setEditTarget(child)
                                setEditName(child.name)
                              }}
                              onMigrate={() => {
                                setMigrateTarget(child)
                                setMigrateToId('')
                              }}
                              onDelete={() => {
                                setDeleteTarget(child)
                                setDeleteToId('')
                              }}
                            />
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </section>

      <Modal
        open={editTarget != null}
        title="编辑分类"
        onClose={() => setEditTarget(null)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setEditTarget(null)} disabled={busy}>
              取消
            </Button>
            <Button type="button" onClick={() => void handleEditSave()} disabled={busy || !editName.trim()}>
              保存
            </Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="edit-name">名称</label>
          <input
            id="edit-name"
            className="input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        open={migrateTarget != null}
        title="迁移分类"
        onClose={() => setMigrateTarget(null)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setMigrateTarget(null)} disabled={busy}>
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void handleMigrate()}
              disabled={busy || !migrateToId || migrateCount === 0}
            >
              确认迁移
            </Button>
          </>
        }
      >
        {migrateTarget && (
          <>
            <div className="summary-row">
              <span>来源分类</span>
              <span>{migrateTarget.name}（保留）</span>
            </div>
            <div className="summary-row">
              <span>受影响记录</span>
              <span className="summary-num">{migrateCount} 条</span>
            </div>
            {migrateHasTarget ? (
              <div className="field modal-gap">
                <label htmlFor="migrate-to">迁移到（同一层级）</label>
                <Select
                  value={migrateToId}
                  onChange={setMigrateToId}
                  options={migrateTargets.map((c) => ({
                    value: c.id,
                    label: c.name
                  }))}
                  placeholder="请选择目标分类"
                  ariaLabel="目标分类"
                />
              </div>
            ) : (
              <p className="muted modal-note">请先新增一个目标分类，再进行迁移。</p>
            )}
            {migrateCount === 0 && (
              <p className="muted modal-note">
                来源分类暂无记录可迁移。
              </p>
            )}
          </>
        )}
      </Modal>

      <Modal
        open={deleteTarget != null}
        title="删除分类"
        onClose={() => setDeleteTarget(null)}
        footer={
          deleteChildren > 0 ? (
            <Button type="button" onClick={() => setDeleteTarget(null)}>
              知道了
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)} disabled={busy}>
                取消
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => void handleDelete()}
                disabled={busy || (deleteCount > 0 && !deleteToId)}
              >
                {deleteCount > 0 ? '迁移并删除' : '确认删除'}
              </Button>
            </>
          )
        }
      >
        {deleteTarget &&
          (deleteChildren > 0 ? (
            <p className="muted">
              「{deleteTarget.name}」下还有 {deleteChildren} 个子分类，请先处理子分类后再删除。
            </p>
          ) : (
            <>
              <div className="summary-row">
                <span>将删除</span>
                <span>{deleteTarget.name}</span>
              </div>
              <div className="summary-row">
                <span>受影响记录</span>
                <span className="summary-num">{deleteCount} 条</span>
              </div>
              {deleteCount > 0 ? (
                deleteHasTarget ? (
                  <div className="field modal-gap">
                    <label htmlFor="delete-to">记录迁移到（同一层级）</label>
                    <Select
                      value={deleteToId}
                      onChange={setDeleteToId}
                      options={deleteTargets.map((c) => ({
                        value: c.id,
                        label: c.name
                      }))}
                      placeholder="请选择目标分类"
                      ariaLabel="目标分类"
                    />
                  </div>
                ) : (
                  <p className="muted modal-note">请先新增一个目标分类，再删除。</p>
                )
              ) : null}
              <p className="muted modal-warn">
                删除后不可恢复{deleteCount > 0 ? '，记录将迁移到目标分类' : ''}。
              </p>
            </>
          ))}
      </Modal>
    </div>
  )
}
