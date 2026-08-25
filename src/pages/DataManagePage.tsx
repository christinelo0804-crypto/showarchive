import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, PageHeader, SectionTitle } from '../components/ui'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import {
  buildArchiveBlob,
  downloadBlob,
  gatherExportData,
  importMerge,
  importReplace,
  parseArchiveFile,
  previewMerge
} from '../lib/archive'
import type { ParsedArchive } from '../lib/archive'
import { clearAllData, getDataOverview } from '../db/repositories'

type ImportMode = 'merge' | 'replace'

export default function DataManagePage() {
  const toast = useToast()
  const overview = useLiveQuery(() => getDataOverview(), [])
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [busy, setBusy] = useState(false)
  const [parsed, setParsed] = useState<ParsedArchive | null>(null)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [mergePreview, setMergePreview] = useState<{ newCount: number; duplicateCount: number } | null>(null)
  const [replaceAck, setReplaceAck] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteAck, setDeleteAck] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      const result = await gatherExportData()
      const blob = await buildArchiveBlob(result)
      const filename = `ShowArchive-${new Date().toISOString().slice(0, 10)}.showarchive`
      downloadBlob(blob, filename)
      toast.push('success', `已导出 ${result.data.shows.length} 条记录`)
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : '导出失败')
    } finally {
      setBusy(false)
    }
  }

  function openFilePicker() {
    fileRef.current?.click()
  }

  async function handleFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const parsedFile = await parseArchiveFile(file)
      const preview = await previewMerge(parsedFile.data)
      setParsed(parsedFile)
      setMergePreview(preview)
      setMode('merge')
      setReplaceAck(false)
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : '导入失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    if (!parsed) return
    setBusy(true)
    try {
      if (mode === 'replace') {
        await importReplace(parsed)
        toast.push('success', `已替换导入 ${parsed.data.shows.length} 条记录`)
      } else {
        const result = await importMerge(parsed)
        toast.push('success', `已合并导入 ${result.added} 条，跳过重复 ${result.skipped} 条`)
      }
      setParsed(null)
      setMergePreview(null)
      setReplaceAck(false)
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : '导入失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteAll() {
    setBusy(true)
    try {
      await clearAllData()
      toast.push('success', '本设备全部数据已删除')
      setDeleteOpen(false)
      setDeleteAck(false)
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  const importFooter = (
    <>
      <Button type="button" variant="ghost" onClick={() => setParsed(null)} disabled={busy}>
        取消
      </Button>
      <Button
        type="button"
        variant={mode === 'replace' ? 'danger' : 'primary'}
        onClick={() => void handleImport()}
        disabled={busy || (mode === 'replace' && !replaceAck)}
      >
        确认导入
      </Button>
    </>
  )

  const deleteFooter = (
    <>
      <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy}>
        取消
      </Button>
      <Button type="button" variant="danger" onClick={() => void handleDeleteAll()} disabled={busy || !deleteAck}>
        永久删除全部数据
      </Button>
    </>
  )

  return (
    <div className="page">
      <PageHeader
        eyebrow="Data"
        title="数据备份"
        back
      />

      <input
        ref={fileRef}
        type="file"
        accept=".showarchive,application/zip,application/octet-stream"
        hidden
        onChange={(e) => void handleFilePicked(e)}
      />

      <section className="form-section">
        <SectionTitle kicker="Overview">数据概览</SectionTitle>
        <div className="stat-grid stat-grid-4">
          <div className="stat-card">
            <p className="stat-number">{overview?.shows ?? '—'}</p>
            <p className="stat-label">演出记录</p>
          </div>
          <div className="stat-card">
            <p className="stat-number">{overview?.drafts ?? '—'}</p>
            <p className="stat-label">草稿</p>
          </div>
          <div className="stat-card">
            <p className="stat-number">{overview?.trashed ?? '—'}</p>
            <p className="stat-label">回收站</p>
          </div>
          <div className="stat-card">
            <p className="stat-number">{overview?.images ?? '—'}</p>
            <p className="stat-label">图片</p>
          </div>
        </div>
      </section>

      <section className="form-section">
        <SectionTitle kicker="Actions">操作</SectionTitle>
        <div className="settings-list">
          <button type="button" className="settings-row" onClick={() => void handleExport()} disabled={busy}>
            <span className="settings-row-name">创建备份</span>
            <span aria-hidden="true">↓</span>
          </button>
          <button type="button" className="settings-row" onClick={() => openFilePicker()} disabled={busy}>
            <span className="settings-row-name">导入档案</span>
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            className="settings-row"
            onClick={() => {
              setDeleteOpen(true)
              setDeleteAck(false)
            }}
            disabled={busy}
          >
            <span className="settings-row-name">删除本设备全部数据</span>
            <span className="badge badge-danger">危险</span>
          </button>
        </div>

        <p className="muted note-sm">
          说明：导出的档案不包含草稿与回收站中的记录；请妥善保存档案文件，它也是跨设备迁移的唯一方式。
        </p>
      </section>

      <Modal
        open={parsed != null}
        title="导入档案"
        onClose={() => setParsed(null)}
        footer={importFooter}
      >
        {parsed && (
          <>
            <div className="summary-row">
              <span>档案版本</span>
              <span className="summary-num">v{parsed.manifest.formatVersion}</span>
            </div>
            <div className="summary-row">
              <span>导出时间</span>
              <span>{parsed.manifest.exportedAt?.slice(0, 16).replace('T', ' ')}</span>
            </div>
            <div className="summary-row">
              <span>档案中的记录</span>
              <span className="summary-num">{parsed.data.shows.length} 条</span>
            </div>
            <div className="summary-row">
              <span>本机现有记录</span>
              <span className="summary-num">{overview?.shows ?? 0} 条</span>
            </div>

            <div className="import-mode-list">
              <label className={`radio-card ${mode === 'merge' ? 'radio-card-checked' : ''}`}>
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                />
                <span>
                  <strong>合并导入</strong>
                  <span className="settings-row-note">
                    预计新增 {mergePreview?.newCount ?? 0} 条，跳过重复 {mergePreview?.duplicateCount ?? 0} 条
                  </span>
                </span>
              </label>
              <label className={`radio-card ${mode === 'replace' ? 'radio-card-checked' : ''}`}>
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                />
                <span>
                  <strong>替换导入</strong>
                  <span className="settings-row-note">
                    即「恢复备份」：清空本机全部数据后，以档案内容整体覆盖（含设置）
                  </span>
                </span>
              </label>
            </div>

            {mode === 'replace' && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={replaceAck}
                  onChange={(e) => setReplaceAck(e.target.checked)}
                />
                <span className="ack-danger">
                  我已理解：本机现有数据将被全部清空，且此操作不可撤销
                </span>
              </label>
            )}
          </>
        )}
      </Modal>

      <Modal open={deleteOpen} title="删除本设备全部数据" onClose={() => setDeleteOpen(false)} footer={deleteFooter}>
        <p className="modal-alert">
          此操作将永久删除本机全部演出记录、分类、城市、场馆、语言与购票渠道，且无法撤销。
        </p>
        <p className="muted">强烈建议先创建备份，再执行删除。</p>
        <label className="check-row">
          <input type="checkbox" checked={deleteAck} onChange={(e) => setDeleteAck(e.target.checked)} />
          <span className="ack-text">我已确认并理解后果</span>
        </label>
      </Modal>
    </div>
  )
}
