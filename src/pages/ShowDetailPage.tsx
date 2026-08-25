import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { softDeleteShow } from '../db/repositories'
import { Button, PageHeader, SectionTitle, StarRating } from '../components/ui'
import { ImagePreview } from '../components/ImagePreview'
import { Lightbox } from '../components/Lightbox'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { formatFullDate, formatMoney } from '../lib/format'
import type { ImageAsset } from '../types'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  )
}

export default function ShowDetailPage() {
  const toast = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [lightbox, setLightbox] = useState<{
    images: ImageAsset[]
    labels: string[]
    index: number
  } | null>(null)
  const show = useLiveQuery(async () => (id ? await db.shows.get(id) : undefined), [id])
  const cities = useLiveQuery(() => db.cities.toArray(), [])
  const venues = useLiveQuery(() => db.venues.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const languages = useLiveQuery(() => db.languages.toArray(), [])
  const channels = useLiveQuery(() => db.ticketChannels.toArray(), [])

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  if (!show) {
    return (
      <div className="page">
        <p className="muted">记录不存在或已删除。</p>
      </div>
    )
  }

  const cityName = cities?.find((c) => c.id === show.cityId)?.name ?? ''
  const venueName = venues?.find((v) => v.id === show.venueId)?.name ?? ''
  const category2Name = show.categoryLevel2Id
    ? categories?.find((c) => c.id === show.categoryLevel2Id)?.name
    : null
  const category1Name = categories?.find((c) => c.id === show.categoryLevel1Id)?.name ?? null
  const displayCategoryName = category2Name ?? category1Name
  const languageName = show.languageId
    ? languages?.find((l) => l.id === show.languageId)?.name
    : null
  const channelName = show.ticketChannelId
    ? channels?.find((c) => c.id === show.ticketChannelId)?.name
    : null
  const noteImages = show.noteImages ?? []
  const noteLabels = noteImages.map((_, i) => `图${i + 1}`)
  const posterAsset = show.poster
  const ticketAsset = show.ticketImage
  const seatViewAsset = show.seatViewImage

  function openLightbox(images: ImageAsset[], labels: string[], index: number) {
    setLightbox({ images, labels, index })
  }

  async function handleDelete() {
    if (!id) return
    await softDeleteShow(id)
    setDeleteOpen(false)
    toast.push('success', '记录已移入回收站')
    navigate('/shows', { replace: true })
  }

  return (
    <div className="page page-detail">
      <PageHeader
        eyebrow={show.isDraft ? 'Draft' : 'Archive Entry'}
        title={show.title}
        subtitle={`${formatFullDate(show.date)} ${show.time} · ${cityName} · ${venueName}`}
        back
        action={
          <div className="detail-actions" ref={menuRef}>
            <Button
              type="button"
              variant="ghost"
              className="btn-sm"
              onClick={() => navigate(`/shows/${show.id}/edit`, { replace: true })}
            >
              编辑
            </Button>
            <button
              type="button"
              className="icon-btn detail-more-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="更多操作"
              aria-expanded={menuOpen}
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="menu detail-more-menu">
                <button
                  type="button"
                  className="menu-item danger"
                  onClick={() => {
                    setMenuOpen(false)
                    setDeleteOpen(true)
                  }}
                >
                  删除
                </button>
              </div>
            )}
          </div>
        }
      />

      <div className="detail-meta">
        <span className={`status-chip status-${show.status}`}>
          {show.status === 'upcoming' ? '待观看' : '已观看'}
        </span>
        {displayCategoryName && <span className="category-chip">{displayCategoryName}</span>}
        {languageName && <span className="category-chip">{languageName}</span>}
      </div>

      {posterAsset && (
        <div className="detail-poster">
          <button
            type="button"
            className="detail-image-btn"
            onClick={() => openLightbox([posterAsset], ['海报'], 0)}
          >
            <ImagePreview asset={posterAsset} alt={show.title} className="detail-poster-img" />
          </button>
        </div>
      )}

      {show.content && (
        <section className="form-section">
          <SectionTitle kicker="Content">演出内容</SectionTitle>
          <p className="detail-prose">{show.content}</p>
        </section>
      )}

      <section className="form-section">
        <SectionTitle kicker="Details">详细信息</SectionTitle>
        <div className="detail-rows">
          {channelName && <Row label="购票渠道" value={channelName} />}
          {show.seat && <Row label="座位号" value={show.seat} />}
          <Row label="票面价格" value={formatMoney(show.faceValue)} />
          <Row label="实付价格" value={formatMoney(show.paidPrice)} />
          {show.cast && <Row label="演出阵容" value={show.cast} />}
        </div>
      </section>

      {(show.rating != null || show.review) && (
        <section className="form-section">
          {show.rating != null && (
            <>
              <SectionTitle kicker="Rating">我的评分</SectionTitle>
              <div className="rating-block">
                <StarRating value={show.rating} />
              </div>
            </>
          )}
          {show.review && (
            <>
              <SectionTitle kicker="Review">我的评价</SectionTitle>
              <p className="detail-prose">{show.review}</p>
            </>
          )}
        </section>
      )}

      {ticketAsset && (
        <section className="form-section">
          <SectionTitle kicker="Ticket">票根图</SectionTitle>
          <button
            type="button"
            className="detail-image-btn"
            onClick={() => openLightbox([ticketAsset], ['票根图'], 0)}
          >
            <div className="detail-image-single">
              <ImagePreview asset={ticketAsset} alt="票根图" />
            </div>
          </button>
        </section>
      )}

      {seatViewAsset && (
        <section className="form-section">
          <SectionTitle kicker="Seat View">座位视角图</SectionTitle>
          <button
            type="button"
            className="detail-image-btn"
            onClick={() => openLightbox([seatViewAsset], ['座位视角图'], 0)}
          >
            <div className="detail-image-single">
              <ImagePreview asset={seatViewAsset} alt="座位视角图" />
            </div>
          </button>
        </section>
      )}

      {(show.notes || noteImages.length > 0) && (
        <section className="form-section">
          <SectionTitle kicker="Notes">备注</SectionTitle>
          {show.notes && <p className="detail-prose">{show.notes}</p>}
          {noteImages.length > 0 && (
            <div className="gallery-grid gallery-grid-notes">
              {noteImages.map((asset, i) => (
                <figure key={i} className="gallery-item">
                  <button
                    type="button"
                    className="detail-image-btn"
                    onClick={() => openLightbox(noteImages, noteLabels, i)}
                  >
                    <ImagePreview asset={asset} alt={`图${i + 1}`} />
                  </button>
                  <figcaption>图{i + 1}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          labels={lightbox.labels}
          index={lightbox.index}
          onChange={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
          onClose={() => setLightbox(null)}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="删除记录"
        message="删除后记录会进入回收站，可随时恢复。"
        confirmText="删除"
        danger
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  )
}
