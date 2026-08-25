import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  deleteLanguage,
  ensureLanguage,
  migrateLanguageRecords,
  updateLanguage
} from '../db/repositories'
import { Button, EmptyState, MoreMenu, PageHeader, SectionTitle } from '../components/ui'
import { Modal } from '../components/Modal'
import { Select } from '../components/Select'
import { useToast } from '../components/Toast'
import type { Language } from '../types'

export default function LanguageManagePage() {
  const toast = useToast()
  const languages = useLiveQuery(() => db.languages.toArray(), [])
  const shows = useLiveQuery(() => db.shows.toArray(), [])

  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [editTarget, setEditTarget] = useState<Language | null>(null)
  const [editName, setEditName] = useState('')
  const [migrateTarget, setMigrateTarget] = useState<Language | null>(null)
  const [migrateToId, setMigrateToId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Language | null>(null)
  const [deleteToId, setDeleteToId] = useState('')

  const countMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of shows ?? []) {
      if (!s.languageId) continue
      map.set(s.languageId, (map.get(s.languageId) ?? 0) + 1)
    }
    return map
  }, [shows])
  const countOf = (id: string) => countMap.get(id) ?? 0
  const sorted = [...(languages ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  const q = query.trim().toLowerCase()
  const visible = sorted.filter((l) => !q || l.name.toLowerCase().includes(q))

  async function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.push('error', '请输入语言名称')
      return
    }
    if (languages?.some((l) => l.name === trimmed)) {
      toast.push('error', '已存在同名语言')
      return
    }
    await ensureLanguage(trimmed)
    setName('')
    toast.push('success', `已新增「${trimmed}」`)
  }

  async function handleEditSave() {
    if (!editTarget) return
    setBusy(true)
    try {
      await updateLanguage(editTarget.id, editName)
      toast.push('success', '语言已更新')
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
      const count = await migrateLanguageRecords(migrateTarget.id, migrateToId)
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
      const migrated = await deleteLanguage(deleteTarget.id, deleteToId || undefined)
      toast.push('success', deleteToId ? `已迁移 ${migrated} 条记录并删除语言` : '语言已删除')
      setDeleteTarget(null)
      setDeleteToId('')
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  const migrateCount = migrateTarget ? countOf(migrateTarget.id) : 0
  const deleteCount = deleteTarget ? countOf(deleteTarget.id) : 0
  const migrateTargets = migrateTarget ? sorted.filter((l) => l.id !== migrateTarget.id) : []
  const deleteTargets = deleteTarget ? sorted.filter((l) => l.id !== deleteTarget.id) : []
  const migrateHasTarget = migrateTargets.length > 0
  const deleteHasTarget = deleteTargets.length > 0

  function focusAdd() {
    const input = document.getElementById('lang-name')
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    input?.focus()
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Languages"
        title="演出语言管理"
        back
      />

      <section className="form-section">
        <SectionTitle kicker="New">新增语言</SectionTitle>
        <div className="manage-add-row">
          <input
            id="lang-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="语言名称，例如：英语 / 粤语"
          />
          <Button type="button" onClick={() => void handleAdd()}>
            添加语言
          </Button>
        </div>
      </section>

      <section className="form-section">
        <SectionTitle kicker="Languages">语言列表</SectionTitle>
        <input
          className="input list-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索语言…"
        />
        {sorted.length === 0 ? (
          <EmptyState title="还没有语言" hint="先添加一个，新增演出时就能在语言里选择了。">
            <Button type="button" onClick={focusAdd}>
              添加语言
            </Button>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState title="没有匹配的语言" hint="换个关键词试试。" />
        ) : (
          visible.map((language) => (
            <div key={language.id} className="item-row">
              <span className="name">{language.name}</span>
              <span className="count">{countOf(language.id)} 场</span>
              <MoreMenu
                onEdit={() => {
                  setEditTarget(language)
                  setEditName(language.name)
                }}
                onMigrate={() => {
                  setMigrateTarget(language)
                  setMigrateToId('')
                }}
                onDelete={() => {
                  setDeleteTarget(language)
                  setDeleteToId('')
                }}
              />
            </div>
          ))
        )}
      </section>

      <Modal
        open={editTarget != null}
        title="编辑语言"
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
        title="迁移语言"
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
              <span>来源语言</span>
              <span>{migrateTarget.name}（保留）</span>
            </div>
            <div className="summary-row">
              <span>受影响记录</span>
              <span className="summary-num">{migrateCount} 条</span>
            </div>
            {migrateHasTarget ? (
              <div className="field modal-gap">
                <label htmlFor="migrate-to">迁移到（其他语言）</label>
                <Select
                  value={migrateToId}
                  onChange={setMigrateToId}
                  options={migrateTargets.map((l) => ({ value: l.id, label: l.name }))}
                  placeholder="请选择目标语言"
                  ariaLabel="目标语言"
                />
              </div>
            ) : (
              <p className="muted modal-note">请先新增一个目标语言，再进行迁移。</p>
            )}
            {migrateCount === 0 && (
              <p className="muted modal-note">
                来源语言暂无记录可迁移。
              </p>
            )}
          </>
        )}
      </Modal>

      <Modal
        open={deleteTarget != null}
        title="删除语言"
        onClose={() => setDeleteTarget(null)}
        footer={
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
        }
      >
        {deleteTarget && (
          <>
            <div className="summary-row">
              <span>将删除</span>
              <span>{deleteTarget.name}</span>
            </div>
            <div className="summary-row">
              <span>受影响记录</span>
              <span className="summary-num">{deleteCount} 条</span>
            </div>
            {deleteCount > 0 && (
              deleteHasTarget ? (
                <div className="field modal-gap">
                  <label htmlFor="delete-to">记录迁移到（其他语言）</label>
                  <Select
                    value={deleteToId}
                    onChange={setDeleteToId}
                    options={deleteTargets.map((l) => ({ value: l.id, label: l.name }))}
                    placeholder="请选择目标语言"
                    ariaLabel="目标语言"
                  />
                </div>
              ) : (
                <p className="muted modal-note">请先新增一个目标语言，再删除。</p>
              )
            )}
            <p className="muted modal-warn">
              删除后不可恢复{deleteCount > 0 ? '，记录将迁移到目标语言' : ''}。
            </p>
          </>
        )}
      </Modal>
    </div>
  )
}
