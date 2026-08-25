import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  addCategory,
  ensureCity,
  ensureLanguage,
  ensureTicketChannel,
  ensureVenue
} from '../db/repositories'
import type { ShowPayload } from '../db/repositories'
import { processImageFile } from '../lib/image'
import type { Category, ImageAsset, Show, ShowStatus } from '../types'
import { Button, PageHeader, SectionTitle, StarRating } from './ui'
import { ConfirmDialog } from './ConfirmDialog'
import { ImagePreview } from './ImagePreview'
import { Select } from './Select'
import { DatePicker } from './DatePicker'
import { TimePicker } from './TimePicker'
import { useToast } from './Toast'

interface FormState {
  title: string
  date: string
  time: string
  cityId: string
  newCity: string
  venueId: string
  newVenue: string
  categoryLevel1Id: string
  categoryLevel2Id: string
  newCategory1: string
  newCategory2: string
  status: ShowStatus
  languageId: string
  newLanguage: string
  ticketChannelId: string
  newTicketChannel: string
  seat: string
  cast: string
  content: string
  faceValue: string
  paidPrice: string
  rating: number | null
  review: string
  notes: string
  poster: ImageAsset | null
  ticketImage: ImageAsset | null
  seatViewImage: ImageAsset | null
  noteImages: ImageAsset[]
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function initialForm(): FormState {
  return {
    title: '',
    date: today(),
    time: nowTime(),
    cityId: '',
    newCity: '',
    venueId: '',
    newVenue: '',
    categoryLevel1Id: '',
    categoryLevel2Id: '',
    newCategory1: '',
    newCategory2: '',
    status: 'upcoming',
    languageId: '',
    newLanguage: '',
    ticketChannelId: '',
    newTicketChannel: '',
    seat: '',
    cast: '',
    content: '',
    faceValue: '',
    paidPrice: '',
    rating: null,
    review: '',
    notes: '',
    poster: null,
    ticketImage: null,
    seatViewImage: null,
    noteImages: []
  }
}

function formFromShow(show: Show): FormState {
  return {
    title: show.title,
    date: show.date,
    time: show.time,
    cityId: show.cityId,
    newCity: '',
    venueId: show.venueId,
    newVenue: '',
    categoryLevel1Id: show.categoryLevel1Id,
    categoryLevel2Id: show.categoryLevel2Id ?? '',
    newCategory1: '',
    newCategory2: '',
    status: show.status,
    languageId: show.languageId ?? '',
    newLanguage: '',
    ticketChannelId: show.ticketChannelId ?? '',
    newTicketChannel: '',
    seat: show.seat ?? '',
    cast: show.cast ?? '',
    content: show.content ?? '',
    faceValue: show.faceValue != null ? String(show.faceValue) : '',
    paidPrice: show.paidPrice != null ? String(show.paidPrice) : '',
    rating: show.rating ?? null,
    review: show.review ?? '',
    notes: show.notes ?? '',
    poster: show.poster ?? null,
    ticketImage: show.ticketImage ?? null,
    seatViewImage: show.seatViewImage ?? null,
    noteImages: show.noteImages ?? []
  }
}

function EntityPicker({
  label,
  required,
  htmlId,
  value,
  options,
  creating,
  newValue,
  busy,
  onSelect,
  onNewValue,
  onConfirm,
  onSwitchToCreate,
  onCancelCreate
}: {
  label: string
  required?: boolean
  htmlId: string
  value: string
  options: Array<{ id: string; name: string }>
  creating: boolean
  newValue: string
  busy?: boolean
  onSelect: (id: string) => void
  onNewValue: (value: string) => void
  onConfirm: () => void
  onSwitchToCreate: () => void
  onCancelCreate: () => void
}) {
  return (
    <div className="field">
      <label htmlFor={htmlId}>
        {label}
        {required ? ' *' : ''}
      </label>
      {!creating && options.length > 0 ? (
        <Select
          id={htmlId}
          value={value}
          onChange={(v) => {
            if (v === '__new__') onSwitchToCreate()
            else onSelect(v)
          }}
          options={[
            ...options.map((o) => ({ value: o.id, label: o.name })),
            { value: '__new__', label: '＋ 新增…' }
          ]}
          placeholder="请选择"
          ariaLabel={label}
        />
      ) : (
        <>
          <input
            id={htmlId}
            className="input"
            value={newValue}
            onChange={(e) => onNewValue(e.target.value)}
            placeholder={label}
          />
          <div className="entity-actions">
            <Button type="button" onClick={onConfirm} disabled={!newValue.trim() || busy}>
              确认新增
            </Button>
            {options.length > 0 && (
              <Button type="button" variant="ghost" onClick={onCancelCreate}>
                取消
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ImageUploader({
  label,
  asset,
  onChange
}: {
  label: string
  asset: ImageAsset | null
  onChange: (asset: ImageAsset | null) => void
}) {
  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const processed = await processImageFile(file)
    onChange(processed)
    e.target.value = ''
  }
  return (
    <div className="field">
      <label>{label}</label>
      <label className="upload-zone">
        <input type="file" accept="image/*" onChange={(e) => void handleFile(e)} hidden />
        {asset ? <ImagePreview asset={asset} alt={label} /> : <span>点击选择图片</span>}
      </label>
      {asset && (
        <Button type="button" variant="ghost" onClick={() => onChange(null)}>
          移除图片
        </Button>
      )}
    </div>
  )
}

function NoteImagesField({
  images,
  onChange
}: {
  images: ImageAsset[]
  onChange: (images: ImageAsset[]) => void
}) {
  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 10 - images.length)
    if (files.length === 0) return
    const processed = await Promise.all(files.map(processImageFile))
    onChange([...images, ...processed])
    e.target.value = ''
  }
  return (
    <div className="field">
      <label>备注图片（最多 10 张）</label>
      {images.length > 0 && (
        <div className="note-image-grid">
          {images.map((img, i) => (
            <div key={i} className="note-image">
              <ImagePreview asset={img} alt={`图${i + 1}`} />
              <button
                type="button"
                className="note-image-remove"
                onClick={() => onChange(images.filter((_, j) => j !== i))}
                aria-label={`移除第 ${i + 1} 张`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length < 10 && (
        <label className="upload-zone upload-zone-small">
          <input type="file" accept="image/*" multiple onChange={(e) => void handleFiles(e)} hidden />
          <span>＋ 添加备注图片（{images.length}/10）</span>
        </label>
      )}
    </div>
  )
}

export function ShowForm({
  mode,
  initial,
  onSave,
  onCancel
}: {
  mode: 'create' | 'edit'
  initial?: Show | null
  onSave: (payload: ShowPayload, opts: { publish: boolean }) => Promise<void>
  onCancel?: () => void
}) {
  const toast = useToast()
  const cities = useLiveQuery(() => db.cities.toArray(), [])
  const venues = useLiveQuery(() => db.venues.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const languages = useLiveQuery(() => db.languages.toArray(), [])
  const channels = useLiveQuery(() => db.ticketChannels.toArray(), [])

  const [form, setForm] = useState<FormState>(initialForm)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [addingCity, setAddingCity] = useState(false)
  const [addingVenue, setAddingVenue] = useState(false)
  const [addingCategory1, setAddingCategory1] = useState(false)
  const [addingCategory2, setAddingCategory2] = useState(false)
  const [addingLanguage, setAddingLanguage] = useState(false)
  const [addingChannel, setAddingChannel] = useState(false)
  const initializedRef = useRef(false)

  const bySort = (a: Category, b: Category) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN')
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, 'zh-CN')
  const level1 = (categories ?? []).filter((c) => !c.parentId).sort(bySort)
  const level2 = (categories ?? []).filter((c) => c.parentId === form.categoryLevel1Id).sort(bySort)
  const cityVenues = (venues ?? []).filter((v) => v.cityId === form.cityId).sort(byName)

  useEffect(() => {
    if (mode !== 'edit' || !initial || initializedRef.current) return
    setForm(formFromShow(initial))
    initializedRef.current = true
  }, [mode, initial])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }

  function resetCityDependent() {
    setField('venueId', '')
    setField('newVenue', '')
    setAddingVenue(false)
  }

  async function confirmEntity(
    create: () => Promise<string>,
    name: string,
    apply: (id: string) => void
  ) {
    if (!name.trim()) return
    setConfirming(true)
    try {
      const id = await create()
      apply(id)
      toast.push('success', `已新增「${name.trim()}」`)
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : '新增失败')
    } finally {
      setConfirming(false)
    }
  }

  const confirmCity = () =>
    confirmEntity(() => ensureCity(form.newCity), form.newCity, (id) => {
      setField('cityId', id)
      setField('newCity', '')
      setAddingCity(false)
    })

  const confirmVenue = () => {
    if (!form.cityId) {
      toast.push('error', '请先点击「确认新增」完成城市创建')
      return
    }
    return confirmEntity(() => ensureVenue(form.newVenue, form.cityId), form.newVenue, (id) => {
      setField('venueId', id)
      setField('newVenue', '')
      setAddingVenue(false)
    })
  }

  const confirmCategory1 = () =>
    confirmEntity(() => addCategory(form.newCategory1, null), form.newCategory1, (id) => {
      setField('categoryLevel1Id', id)
      setField('newCategory1', '')
      setAddingCategory1(false)
    })

  const confirmCategory2 = () => {
    if (!form.categoryLevel1Id) {
      toast.push('error', '请先点击「确认新增」完成一级类别创建')
      return
    }
    return confirmEntity(
      () => addCategory(form.newCategory2, form.categoryLevel1Id),
      form.newCategory2,
      (id) => {
        setField('categoryLevel2Id', id)
        setField('newCategory2', '')
        setAddingCategory2(false)
      }
    )
  }

  const confirmLanguage = () =>
    confirmEntity(() => ensureLanguage(form.newLanguage), form.newLanguage, (id) => {
      setField('languageId', id)
      setField('newLanguage', '')
      setAddingLanguage(false)
    })

  const confirmChannel = () =>
    confirmEntity(() => ensureTicketChannel(form.newTicketChannel), form.newTicketChannel, (id) => {
      setField('ticketChannelId', id)
      setField('newTicketChannel', '')
      setAddingChannel(false)
    })

  async function handleSave(publish: boolean) {
    if (!form.title.trim() || !form.date || !form.time) {
      toast.push('error', '请填写名称、日期和时间')
      return
    }
    if (!form.cityId) {
      if (!form.newCity.trim()) {
        toast.push('error', '请选择或输入城市')
        return
      }
      toast.push('error', '请先点击「确认新增」完成城市创建')
      return
    }
    if (!form.venueId) {
      if (!form.newVenue.trim()) {
        toast.push('error', '请选择或输入场馆')
        return
      }
      toast.push('error', '请先点击「确认新增」完成场馆创建')
      return
    }
    if (!form.categoryLevel1Id) {
      if (!form.newCategory1.trim()) {
        toast.push('error', '请选择或输入一级类别')
        return
      }
      toast.push('error', '请先点击「确认新增」完成一级类别创建')
      return
    }
    if (form.newCategory2.trim()) {
      toast.push('error', '请先点击「确认新增」完成二级类别创建')
      return
    }
    if (form.newLanguage.trim()) {
      toast.push('error', '请先点击「确认新增」完成语言创建')
      return
    }
    if (form.newTicketChannel.trim()) {
      toast.push('error', '请先点击「确认新增」完成购票渠道创建')
      return
    }

    setBusy(true)
    try {
      await onSave(
        {
          title: form.title,
          date: form.date,
          time: form.time,
          cityId: form.cityId,
          venueId: form.venueId,
          categoryLevel1Id: form.categoryLevel1Id,
          categoryLevel2Id: form.categoryLevel2Id || null,
          status: form.status,
          languageId: form.languageId || undefined,
          seat: form.seat.trim() || undefined,
          cast: form.cast.trim() || undefined,
          content: form.content.trim() || undefined,
          ticketChannelId: form.ticketChannelId || undefined,
          faceValue: form.faceValue ? Number(form.faceValue) : undefined,
          paidPrice: form.paidPrice ? Number(form.paidPrice) : undefined,
          rating: form.rating ?? undefined,
          review: form.review,
          notes: form.notes,
          poster: form.poster ?? undefined,
          ticketImage: form.ticketImage ?? undefined,
          seatViewImage: form.seatViewImage ?? undefined,
          noteImages: form.noteImages.length > 0 ? form.noteImages : undefined
        },
        { publish }
      )
      setDirty(false)
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  function handleCancel() {
    if (dirty) {
      setDiscardOpen(true)
      return
    }
    if (onCancel) onCancel()
    else window.history.back()
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={mode === 'edit' ? 'Edit Entry' : 'New Entry'}
        title={mode === 'edit' ? '编辑演出' : '新增演出'}
        back={handleCancel}
        action={
          mode === 'edit' ? (
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={busy}>
              退出编辑
            </Button>
          ) : undefined
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSave(true)
        }}
      >
        <section className="form-section">
          <SectionTitle kicker="Info">演出信息</SectionTitle>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="title">名称 *</label>
              <input
                id="title"
                className="input"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="例如：XXX 演唱会"
              />
            </div>
            <div className="field">
              <label htmlFor="status">状态 *</label>
              <Select
                id="status"
                value={form.status}
                onChange={(v) => setField('status', v as ShowStatus)}
                options={[
                  { value: 'upcoming', label: '待观看' },
                  { value: 'watched', label: '已观看' }
                ]}
                ariaLabel="状态"
              />
            </div>
            <div className="field">
              <label htmlFor="date">日期 *</label>
              <DatePicker
                id="date"
                value={form.date}
                onChange={(v) => setField('date', v)}
                ariaLabel="日期"
              />
            </div>
            <div className="field">
              <label htmlFor="time">时间 *</label>
              <TimePicker
                id="time"
                value={form.time}
                onChange={(v) => setField('time', v)}
                ariaLabel="时间"
              />
            </div>
            <EntityPicker
              label="城市"
              required
              htmlId="city"
              value={form.cityId}
              options={[...(cities ?? [])].sort(byName)}
              creating={addingCity}
              newValue={form.newCity}
              busy={confirming}
              onSelect={(id) => {
                setField('cityId', id)
                resetCityDependent()
              }}
              onNewValue={(v) => setField('newCity', v)}
              onConfirm={() => void confirmCity()}
              onSwitchToCreate={() => {
                setField('cityId', '')
                setAddingCity(true)
                resetCityDependent()
              }}
              onCancelCreate={() => setAddingCity(false)}
            />
            {!form.cityId ? (
              <div className="field">
                <label htmlFor="venue">场馆 *</label>
                <input
                  id="venue"
                  className="input"
                  placeholder={
                    form.newCity.trim() ? '请先点击「确认新增」完成城市创建' : '请先选择或输入城市'
                  }
                  disabled
                />
              </div>
            ) : (
              <EntityPicker
                label="场馆"
                required
                htmlId="venue"
                value={form.venueId}
                options={cityVenues}
                creating={addingVenue}
                newValue={form.newVenue}
                busy={confirming}
                onSelect={(id) => setField('venueId', id)}
                onNewValue={(v) => setField('newVenue', v)}
                onConfirm={() => void confirmVenue()}
                onSwitchToCreate={() => {
                  setField('venueId', '')
                  setAddingVenue(true)
                }}
                onCancelCreate={() => setAddingVenue(false)}
              />
            )}
            <EntityPicker
              label="一级类别"
              required
              htmlId="cat1"
              value={form.categoryLevel1Id}
              options={level1}
              creating={addingCategory1}
              newValue={form.newCategory1}
              busy={confirming}
              onSelect={(id) => {
                setField('categoryLevel1Id', id)
                setField('categoryLevel2Id', '')
                setAddingCategory2(false)
              }}
              onNewValue={(v) => setField('newCategory1', v)}
              onConfirm={() => void confirmCategory1()}
              onSwitchToCreate={() => {
                setField('categoryLevel1Id', '')
                setField('categoryLevel2Id', '')
                setAddingCategory1(true)
                setAddingCategory2(false)
              }}
              onCancelCreate={() => setAddingCategory1(false)}
            />
            <div className="field">
              <label htmlFor="cat2">二级类别</label>
              {!form.categoryLevel1Id ? (
                <input id="cat2" className="input" placeholder="请先选择或输入一级类别" disabled />
              ) : addingCategory2 ? (
                <>
                  <input
                    id="cat2"
                    className="input"
                    value={form.newCategory2}
                    onChange={(e) => setField('newCategory2', e.target.value)}
                    placeholder={
                      level1.find((c) => c.id === form.categoryLevel1Id)
                        ? `新增「${level1.find((c) => c.id === form.categoryLevel1Id)?.name}」的二级分类`
                        : '输入二级分类名称'
                    }
                  />
                  <div className="entity-actions">
                    <Button
                      type="button"
                      onClick={() => void confirmCategory2()}
                      disabled={!form.newCategory2.trim() || confirming}
                    >
                      确认新增
                    </Button>
                    {level2.length > 0 && (
                      <Button type="button" variant="ghost" onClick={() => setAddingCategory2(false)}>
                        取消
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <Select
                  id="cat2"
                  value={form.categoryLevel2Id}
                  onChange={(v) => {
                    if (v === '__new__') {
                      setField('categoryLevel2Id', '')
                      setAddingCategory2(true)
                    } else {
                      setField('categoryLevel2Id', v)
                    }
                  }}
                  options={[
                    { value: '', label: '无 / 不适用' },
                    ...level2.map((c) => ({ value: c.id, label: c.name })),
                    { value: '__new__', label: '＋ 新增…' }
                  ]}
                  ariaLabel="二级类别"
                />
              )}
            </div>
            <EntityPicker
              label="语言"
              htmlId="language"
              value={form.languageId}
              options={[...(languages ?? [])].sort(byName)}
              creating={addingLanguage}
              newValue={form.newLanguage}
              busy={confirming}
              onSelect={(id) => setField('languageId', id)}
              onNewValue={(v) => setField('newLanguage', v)}
              onConfirm={() => void confirmLanguage()}
              onSwitchToCreate={() => {
                setField('languageId', '')
                setAddingLanguage(true)
              }}
              onCancelCreate={() => setAddingLanguage(false)}
            />
            <div className="field">
              <label htmlFor="seat">座位号</label>
              <input
                id="seat"
                className="input"
                value={form.seat}
                onChange={(e) => setField('seat', e.target.value)}
                placeholder="例如：A 区 12 排 8 号"
              />
            </div>
            <div className="field">
              <label htmlFor="cast">演出阵容</label>
              <input
                id="cast"
                className="input"
                value={form.cast}
                onChange={(e) => setField('cast', e.target.value)}
                placeholder="主演、歌手或乐队等"
              />
            </div>
            <div className="field">
              <label htmlFor="content">演出内容</label>
              <textarea
                id="content"
                className="textarea"
                value={form.content}
                onChange={(e) => setField('content', e.target.value)}
                placeholder="曲目单、比赛看点等"
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <SectionTitle kicker="Tickets">票务</SectionTitle>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="face">票面价格（元）</label>
              <input
                id="face"
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.faceValue}
                onChange={(e) => setField('faceValue', e.target.value)}
                placeholder="仅填写数字"
              />
            </div>
            <div className="field">
              <label htmlFor="paid">实付价格（元）</label>
              <input
                id="paid"
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.paidPrice}
                onChange={(e) => setField('paidPrice', e.target.value)}
                placeholder="仅填写数字"
              />
            </div>
            <EntityPicker
              label="购票渠道"
              htmlId="channel"
              value={form.ticketChannelId}
              options={[...(channels ?? [])].sort(byName)}
              creating={addingChannel}
              newValue={form.newTicketChannel}
              busy={confirming}
              onSelect={(id) => setField('ticketChannelId', id)}
              onNewValue={(v) => setField('newTicketChannel', v)}
              onConfirm={() => void confirmChannel()}
              onSwitchToCreate={() => {
                setField('ticketChannelId', '')
                setAddingChannel(true)
              }}
              onCancelCreate={() => setAddingChannel(false)}
            />
          </div>
        </section>

        <section className="form-section">
          <SectionTitle kicker="Images">图片</SectionTitle>
          <div className="form-grid">
            <ImageUploader
              label="海报"
              asset={form.poster}
              onChange={(a) => setField('poster', a)}
            />
            <ImageUploader
              label="票根图"
              asset={form.ticketImage}
              onChange={(a) => setField('ticketImage', a)}
            />
            <ImageUploader
              label="座位视角图"
              asset={form.seatViewImage}
              onChange={(a) => setField('seatViewImage', a)}
            />
          </div>
        </section>

        <section className="form-section">
          <SectionTitle kicker="Personal">评分与个人记录</SectionTitle>
          <div className="field">
            <label>我的评分</label>
            <StarRating
              value={form.rating ?? undefined}
              onChange={(v) => setField('rating', v === 0 ? null : v)}
            />
          </div>
          <div className="field">
            <label htmlFor="review">我的评价</label>
            <textarea
              id="review"
              className="textarea"
              value={form.review}
              onChange={(e) => setField('review', e.target.value)}
              placeholder="写几句当时的感受…"
            />
          </div>
          <div className="field">
            <label htmlFor="notes">备注</label>
            <textarea
              id="notes"
              className="textarea"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="其他想记住的事"
            />
          </div>
          <NoteImagesField images={form.noteImages} onChange={(imgs) => setField('noteImages', imgs)} />
        </section>

        <div className="form-actions">
          {mode === 'edit' && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleSave(false)}
              disabled={busy}
            >
              保存草稿
            </Button>
          )}
          {mode === 'create' && (
            <Button type="button" variant="ghost" onClick={() => void handleSave(false)} disabled={busy}>
              保存草稿
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {mode === 'edit' ? '更新记录' : '发布记录'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={discardOpen}
        title="未保存的修改"
        message="修改尚未保存，确定要退出吗？"
        confirmText="退出"
        cancelText="继续编辑"
        danger
        onConfirm={() => {
          setDiscardOpen(false)
          if (onCancel) onCancel()
          else window.history.back()
        }}
        onClose={() => setDiscardOpen(false)}
      />
    </div>
  )
}
