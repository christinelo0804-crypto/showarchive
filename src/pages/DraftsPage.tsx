import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { draftShows, softDeleteShow } from '../db/repositories'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { formatDateWithYear } from '../lib/format'

export default function DraftsPage() {
  const toast = useToast()
  const drafts = useLiveQuery(() => draftShows(), [])
  const cities = useLiveQuery(() => db.cities.toArray(), [])
  const venues = useLiveQuery(() => db.venues.toArray(), [])
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!pendingDelete) return
    setBusy(true)
    await softDeleteShow(pendingDelete)
    setBusy(false)
    setPendingDelete(null)
    toast.push('success', '草稿已移入回收站')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Drafts"
        title="草稿"
        back
      />

      {!drafts ? (
        <p className="muted">读取中…</p>
      ) : drafts.length === 0 ? (
        <EmptyState title="没有草稿" hint="新增演出时选择「保存草稿」，草稿会出现在这里。" />
      ) : (
        <div className="show-list">
          {drafts.map((d) => {
            const cityName = cities?.find((c) => c.id === d.cityId)?.name ?? ''
            const venueName = venues?.find((v) => v.id === d.venueId)?.name ?? ''
            return (
              <div key={d.id} className="show-row draft-card">
                <div className="draft-card-main">
                  <span className="show-date">{formatDateWithYear(d.date)}</span>
                  <span className="show-body">
                    <span className="show-name">{d.title}</span>
                    <span className="show-sub">
                      {venueName} · {cityName}
                    </span>
                  </span>
                  <Link className="btn btn-ghost" to={`/shows/${d.id}/edit`}>
                    继续编辑
                  </Link>
                  <Button type="button" variant="danger" onClick={() => setPendingDelete(d.id)}>
                    删除
                  </Button>
                </div>
                <div className="draft-updated">更新于 {d.updatedAt.slice(0, 10)}</div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete != null}
        title="删除草稿"
        message="删除后草稿会进入回收站，可随时恢复。"
        confirmText="删除"
        danger
        busy={busy}
        onConfirm={() => void handleDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}
