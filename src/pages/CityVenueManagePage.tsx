import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  deleteCity,
  deleteVenue,
  ensureCity,
  ensureVenue,
  migrateCity,
  migrateVenue,
  updateCity,
  updateVenue
} from '../db/repositories'
import { Button, EmptyState, MoreMenu, PageHeader, SectionTitle } from '../components/ui'
import { Modal } from '../components/Modal'
import { Select } from '../components/Select'
import { useToast } from '../components/Toast'
import type { City, Venue } from '../types'

type Tab = 'city' | 'venue'
type Target = { kind: 'city'; item: City } | { kind: 'venue'; item: Venue }

export default function CityVenueManagePage() {
  const toast = useToast()
  const cities = useLiveQuery(() => db.cities.toArray(), [])
  const venues = useLiveQuery(() => db.venues.toArray(), [])
  const shows = useLiveQuery(() => db.shows.toArray(), [])

  const [tab, setTab] = useState<Tab>('city')
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [newCityName, setNewCityName] = useState('')
  const [newVenueName, setNewVenueName] = useState('')
  const [newVenueCityId, setNewVenueCityId] = useState('')
  const [busy, setBusy] = useState(false)

  const [editTarget, setEditTarget] = useState<Target | null>(null)
  const [editName, setEditName] = useState('')
  const [editVenueCityId, setEditVenueCityId] = useState('')
  const [migrateTarget, setMigrateTarget] = useState<Target | null>(null)
  const [migrateToId, setMigrateToId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Target | null>(null)
  const [deleteToId, setDeleteToId] = useState('')

  const cityShowCount = (id: string) => (shows ?? []).filter((s) => s.cityId === id).length
  const cityVenueCount = (id: string) => (venues ?? []).filter((v) => v.cityId === id).length
  const venueShowCount = (id: string) => (shows ?? []).filter((s) => s.venueId === id).length

  const sortedCities = [...(cities ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  const sortedVenues = [...(venues ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

  const q = query.trim().toLowerCase()
  const visibleCities = sortedCities.filter((c) => !q || c.name.toLowerCase().includes(q))
  const visibleVenueGroups = sortedCities
    .map((city) => {
      const cityMatch = !q || city.name.toLowerCase().includes(q)
      const list = sortedVenues.filter(
        (v) =>
          v.cityId === city.id &&
          (!q || v.name.toLowerCase().includes(q) || city.name.toLowerCase().includes(q))
      )
      return { city, list, show: cityMatch || list.length > 0 }
    })
    .filter((x) => x.show)

  async function handleAddCity() {
    const trimmed = newCityName.trim()
    if (!trimmed) {
      toast.push('error', '请输入城市名称')
      return
    }
    if (cities?.some((c) => c.name === trimmed)) {
      toast.push('error', '已存在同名城市')
      return
    }
    await ensureCity(trimmed)
    setNewCityName('')
    toast.push('success', `已新增「${trimmed}」`)
  }

  async function handleAddVenue() {
    const trimmed = newVenueName.trim()
    if (!trimmed) {
      toast.push('error', '请输入场馆名称')
      return
    }
    if (!newVenueCityId) {
      toast.push('error', '请选择所属城市')
      return
    }
    if (venues?.some((v) => v.cityId === newVenueCityId && v.name === trimmed)) {
      toast.push('error', '该城市下已存在同名场馆')
      return
    }
    await ensureVenue(trimmed, newVenueCityId)
    setNewVenueName('')
    toast.push('success', `已新增「${trimmed}」`)
  }

  async function handleEditSave() {
    if (!editTarget) return
    setBusy(true)
    try {
      if (editTarget.kind === 'city') {
        await updateCity(editTarget.item.id, editName)
      } else {
        await updateVenue(editTarget.item.id, editName, editVenueCityId)
      }
      toast.push('success', '已更新')
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
      if (migrateTarget.kind === 'city') {
        const result = await migrateCity(migrateTarget.item.id, migrateToId)
        toast.push('success', `已迁移 ${result.shows} 条记录、${result.venues} 个场馆`)
      } else {
        const count = await migrateVenue(migrateTarget.item.id, migrateToId)
        toast.push('success', `已迁移 ${count} 条记录`)
      }
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
      if (deleteTarget.kind === 'city') {
        const result = await deleteCity(deleteTarget.item.id, deleteToId || undefined)
        toast.push(
          'success',
          deleteToId
            ? `已迁移 ${result.shows} 条记录、${result.venues} 个场馆并删除城市`
            : '城市已删除'
        )
      } else {
        const migrated = await deleteVenue(deleteTarget.item.id, deleteToId || undefined)
        toast.push('success', deleteToId ? `已迁移 ${migrated} 条记录并删除场馆` : '场馆已删除')
      }
      setDeleteTarget(null)
      setDeleteToId('')
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  const migrateShows = migrateTarget
    ? migrateTarget.kind === 'city'
      ? cityShowCount(migrateTarget.item.id)
      : venueShowCount(migrateTarget.item.id)
    : 0
  const migrateVenues = migrateTarget?.kind === 'city' ? cityVenueCount(migrateTarget.item.id) : 0
  const deleteShows = deleteTarget
    ? deleteTarget.kind === 'city'
      ? cityShowCount(deleteTarget.item.id)
      : venueShowCount(deleteTarget.item.id)
    : 0
  const deleteVenues = deleteTarget?.kind === 'city' ? cityVenueCount(deleteTarget.item.id) : 0

  const migrateCityTargets = migrateTarget?.kind === 'city' ? sortedCities.filter((c) => c.id !== migrateTarget.item.id) : []
  const migrateVenueTargets = migrateTarget?.kind === 'venue' ? sortedVenues.filter((v) => v.id !== migrateTarget.item.id) : []
  const deleteCityTargets = deleteTarget?.kind === 'city' ? sortedCities.filter((c) => c.id !== deleteTarget.item.id) : []
  const deleteVenueTargets = deleteTarget?.kind === 'venue' ? sortedVenues.filter((v) => v.id !== deleteTarget.item.id) : []
  const migrateAffected = migrateShows + migrateVenues
  const deleteAffected = deleteShows + deleteVenues
  const migrateHasTarget = migrateTarget?.kind === 'city' ? migrateCityTargets.length > 0 : migrateVenueTargets.length > 0
  const deleteHasTarget = deleteTarget?.kind === 'city' ? deleteCityTargets.length > 0 : deleteVenueTargets.length > 0

  function focusAddCity() {
    const input = document.getElementById('city-name')
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    input?.focus()
  }

  function focusAddVenue() {
    const input = document.getElementById('venue-name')
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    input?.focus()
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="City & Venue"
        title="城市与场馆管理"
        back
      />

      <section className="form-section">
        <div className="segmented">
          <button
            type="button"
            className={tab === 'city' ? 'seg-active' : ''}
            onClick={() => setTab('city')}
          >
            城市
          </button>
          <button
            type="button"
            className={tab === 'venue' ? 'seg-active' : ''}
            onClick={() => setTab('venue')}
          >
            场馆
          </button>
        </div>
      </section>

      {tab === 'city' ? (
        <>
          <section className="form-section">
            <SectionTitle kicker="New City">新增城市</SectionTitle>
            <div className="manage-add-row">
              <input
                id="city-name"
                className="input"
                value={newCityName}
                onChange={(e) => setNewCityName(e.target.value)}
                placeholder="城市名称"
              />
              <Button type="button" onClick={() => void handleAddCity()}>
                添加城市
              </Button>
            </div>
          </section>

          <section className="form-section">
            <SectionTitle kicker="Cities">城市列表</SectionTitle>
            <input
              className="input list-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索城市…"
            />
            {sortedCities.length === 0 ? (
              <EmptyState title="还没有城市" hint="先添加城市，再添加场馆。">
                <Button type="button" onClick={focusAddCity}>
                  添加城市
                </Button>
              </EmptyState>
            ) : visibleCities.length === 0 ? (
              <EmptyState title="没有匹配的城市" hint="换个关键词试试。" />
            ) : (
              visibleCities.map((city) => (
                <div key={city.id} className="item-row">
                  <span className="name">{city.name}</span>
                  <span className="count">
                    {cityShowCount(city.id)} 场 · {cityVenueCount(city.id)} 个场馆
                  </span>
                  <MoreMenu
                    onEdit={() => {
                      setEditTarget({ kind: 'city', item: city })
                      setEditName(city.name)
                    }}
                    onMigrate={() => {
                      setMigrateTarget({ kind: 'city', item: city })
                      setMigrateToId('')
                    }}
                    onDelete={() => {
                      setDeleteTarget({ kind: 'city', item: city })
                      setDeleteToId('')
                    }}
                  />
                </div>
              ))
            )}
          </section>
        </>
      ) : (
        <>
          <section className="form-section">
            <SectionTitle kicker="New Venue">新增场馆</SectionTitle>
            <div className="manage-add-row">
              <input
                id="venue-name"
                className="input"
                value={newVenueName}
                onChange={(e) => setNewVenueName(e.target.value)}
                placeholder="场馆名称"
              />
              <Select
                value={newVenueCityId}
                onChange={setNewVenueCityId}
                options={sortedCities.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="所属城市"
                ariaLabel="所属城市"
              />
              <Button type="button" onClick={() => void handleAddVenue()}>
                添加
              </Button>
            </div>
          </section>

          <section className="form-section">
            <SectionTitle kicker="Venues">场馆列表</SectionTitle>
            <input
              className="input list-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索场馆…"
            />
            {sortedVenues.length === 0 ? (
              <EmptyState title="还没有场馆" hint="先添加城市，再添加场馆。">
                <Button type="button" onClick={focusAddVenue}>
                  添加场馆
                </Button>
              </EmptyState>
            ) : visibleVenueGroups.length === 0 ? (
              <EmptyState title="没有匹配的场馆" hint="换个关键词试试。" />
            ) : (
              visibleVenueGroups.map(({ city, list }) => {
                const expanded = q ? true : !collapsed[city.id]
                return (
                  <div key={city.id} className="manage-group">
                    <div
                      className="group-head"
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      onClick={() =>
                        setCollapsed((c) => ({ ...c, [city.id]: !collapsed[city.id] }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setCollapsed((c) => ({ ...c, [city.id]: !collapsed[city.id] }))
                        }
                      }}
                    >
                      <span className="chevron">{expanded ? '▾' : '▸'}</span>
                      <span className="name">{city.name}</span>
                      <span className="count">
                        {cityShowCount(city.id)} 场 · {list.length} 个场馆
                      </span>
                    </div>
                    {expanded && (
                      <div className="group-children">
                        {list.map((venue) => (
                          <div key={venue.id} className="item-row">
                            <span className="name">{venue.name}</span>
                            <span className="count">{venueShowCount(venue.id)} 场</span>
                            <MoreMenu
                              onEdit={() => {
                                setEditTarget({ kind: 'venue', item: venue })
                                setEditName(venue.name)
                                setEditVenueCityId(venue.cityId)
                              }}
                              onMigrate={() => {
                                setMigrateTarget({ kind: 'venue', item: venue })
                                setMigrateToId('')
                              }}
                              onDelete={() => {
                                setDeleteTarget({ kind: 'venue', item: venue })
                                setDeleteToId('')
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </section>
        </>
      )}

      <Modal
        open={editTarget != null}
        title={editTarget?.kind === 'venue' ? '编辑场馆' : '编辑城市'}
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
        {editTarget?.kind === 'venue' && (
          <div className="field">
            <label htmlFor="edit-city">所属城市</label>
            <Select
              value={editVenueCityId}
              onChange={setEditVenueCityId}
              options={sortedCities.map((c) => ({ value: c.id, label: c.name }))}
              ariaLabel="所属城市"
            />
          </div>
        )}
      </Modal>

      <Modal
        open={migrateTarget != null}
        title={migrateTarget?.kind === 'venue' ? '迁移场馆' : '迁移城市'}
        onClose={() => setMigrateTarget(null)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setMigrateTarget(null)} disabled={busy}>
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void handleMigrate()}
              disabled={busy || !migrateToId || migrateAffected === 0}
            >
              确认迁移
            </Button>
          </>
        }
      >
        {migrateTarget && (
          <>
            <div className="summary-row">
              <span>来源{migrateTarget.kind === 'city' ? '城市' : '场馆'}</span>
              <span>{migrateTarget.item.name}（保留）</span>
            </div>
            <div className="summary-row">
              <span>受影响记录</span>
              <span className="summary-num">{migrateShows} 条</span>
            </div>
            {migrateTarget.kind === 'city' && (
              <div className="summary-row">
                <span>受影响场馆</span>
                <span className="summary-num">{migrateVenues} 个</span>
              </div>
            )}
            {migrateAffected > 0 && !migrateHasTarget ? (
              <p className="muted modal-note">
                {migrateTarget.kind === 'city' ? '请先新增一个目标城市，再进行迁移。' : '请先新增一个目标场馆，再进行迁移。'}
              </p>
            ) : (
              <div className="field modal-gap">
                <label htmlFor="migrate-to">
                  {migrateTarget.kind === 'city' ? '迁移到（其他城市）' : '迁移到（其他场馆）'}
                </label>
                {migrateTarget.kind === 'city' ? (
                  <Select
                    value={migrateToId}
                    onChange={setMigrateToId}
                    options={migrateCityTargets.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="请选择目标城市"
                    ariaLabel="目标城市"
                  />
                ) : (
                  <Select
                    value={migrateToId}
                    onChange={setMigrateToId}
                    options={sortedCities.flatMap((city) =>
                      migrateVenueTargets
                        .filter((v) => v.cityId === city.id)
                        .map((v) => ({ value: v.id, label: v.name, group: city.name }))
                    )}
                    placeholder="请选择目标场馆"
                    ariaLabel="目标场馆"
                  />
                )}
              </div>
            )}
            {migrateAffected === 0 && (
              <p className="muted modal-note">
                来源暂无记录可迁移。
              </p>
            )}
          </>
        )}
      </Modal>

      <Modal
        open={deleteTarget != null}
        title={deleteTarget?.kind === 'venue' ? '删除场馆' : '删除城市'}
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
              disabled={busy || ((deleteShows > 0 || deleteVenues > 0) && !deleteToId)}
            >
              {deleteShows > 0 || deleteVenues > 0 ? '迁移并删除' : '确认删除'}
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <>
            <div className="summary-row">
              <span>将删除</span>
              <span>{deleteTarget.item.name}</span>
            </div>
            <div className="summary-row">
              <span>受影响记录</span>
              <span className="summary-num">{deleteShows} 条</span>
            </div>
            {deleteTarget.kind === 'city' && (
              <div className="summary-row">
                <span>受影响场馆</span>
                <span className="summary-num">{deleteVenues} 个</span>
              </div>
            )}
            {deleteAffected > 0 ? (
              deleteHasTarget ? (
              <div className="field modal-gap">
                <label htmlFor="delete-to">
                  {deleteTarget.kind === 'city'
                    ? '记录与场馆迁移到（其他城市）'
                    : '记录迁移到（其他场馆）'}
                </label>
                {deleteTarget.kind === 'city' ? (
                  <Select
                    value={deleteToId}
                    onChange={setDeleteToId}
                    options={deleteCityTargets.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="请选择目标城市"
                    ariaLabel="目标城市"
                  />
                ) : (
                  <Select
                    value={deleteToId}
                    onChange={setDeleteToId}
                    options={sortedCities.flatMap((city) =>
                      deleteVenueTargets
                        .filter((v) => v.cityId === city.id)
                        .map((v) => ({ value: v.id, label: v.name, group: city.name }))
                    )}
                    placeholder="请选择目标场馆"
                    ariaLabel="目标场馆"
                  />
                )}
              </div>
              ) : (
                <p className="muted modal-note">
                  {deleteTarget.kind === 'city' ? '请先新增一个目标城市，再删除。' : '请先新增一个目标场馆，再删除。'}
                </p>
              )
            ) : null}
            <p className="muted modal-warn">
              删除后不可恢复
              {deleteShows > 0 || deleteVenues > 0 ? '，内容将迁移到目标项' : ''}。
            </p>
          </>
        )}
      </Modal>
    </div>
  )
}
