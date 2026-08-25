import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { emptyTrash, purgeShow, restoreShow, trashedShows } from '../db/repositories'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { formatDateWithYear } from '../lib/format'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

export default function RecycleBinPage() {
  const toast = useToast()
  const trashed = useLiveQuery(() => trashedShows(), [])
  const [confirmAction, setConfirmAction] = useState<{ type: 'empty' } | { type: 'purge'; id: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleEmpty() {
    setBusy(true)
    await emptyTrash()
    setBusy(false)
    setConfirmAction(null)
    toast.push('success', '回收站已清空')
  }

  async function handlePurge(id: string) {
    setBusy(true)
    await purgeShow(id)
    setBusy(false)
    setConfirmAction(null)
    toast.push('success', '记录已永久删除')
  }

  async function handleRestore(id: string) {
    await restoreShow(id)
    toast.push('success', '记录已恢复')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Trash"
        title="回收站"
        back
        action={
          (trashed?.length ?? 0) > 0 ? (
            <Button type="button" variant="danger" onClick={() => void handleEmpty()}>
              清空回收站
            </Button>
          ) : undefined
        }
      />

      {!trashed ? (
        <p className="muted">读取中…</p>
      ) : trashed.length === 0 ? (
        <EmptyState title="回收站是空的" hint="删除的记录会出现在这里，可恢复或永久删除。" />
      ) : (
        <div className="show-list">
          {trashed.map((show) => (
            <div key={show.id} className="show-row draft-card">
              <div className="draft-card-main">
                <span className="show-date">{formatDateWithYear(show.date)}</span>
                <span className="show-body">
                  <span className="show-name">{show.title}</span>
                </span>
                <Button type="button" variant="ghost" onClick={() => void handleRestore(show.id)}>
                  恢复
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setConfirmAction({ type: 'purge', id: show.id })}
                >
                  永久删除
                </Button>
              </div>
              <div className="draft-updated">删除于 {show.deletedAt?.slice(0, 10)}</div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmAction != null}
        title={confirmAction?.type === 'empty' ? '清空回收站' : '永久删除记录'}
        message={
          confirmAction?.type === 'empty'
            ? '回收站中的全部记录将被永久删除，此操作不可恢复。'
            : '这条记录将被永久删除，此操作不可恢复。'
        }
        confirmText="永久删除"
        danger
        busy={busy}
        onConfirm={() => {
          if (confirmAction?.type === 'empty') void handleEmpty()
          else if (confirmAction?.type === 'purge') void handlePurge(confirmAction.id)
        }}
        onClose={() => setConfirmAction(null)}
      />
    </div>
  )
}
