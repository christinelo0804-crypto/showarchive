import { useEffect, useState } from 'react'
import { seedIfEmpty } from '../db/seed'
import {
  finalizeDefaultCategoryMigrations,
  planDefaultCategoryMigrations
} from '../db/defaultCategories'
import type { MigrationPlan } from '../db/defaultCategories'
import { ConfirmDialog } from './ConfirmDialog'
import { useToast } from './Toast'

function summary(plan: MigrationPlan, removed: string[]): string {
  const parts: string[] = []
  if (plan.added.length > 0) parts.push(`新增「${plan.added.join('」「')}」`)
  if (plan.renamed.length > 0) parts.push(`改名「${plan.renamed.map((r) => `${r.from}→${r.to}`).join('」「')}」`)
  if (plan.reordered.length > 0) parts.push(`调整「${plan.reordered.join('」「')}」的分类顺序`)
  if (removed.length > 0) parts.push(`删除「${removed.join('」「')}」`)
  return parts.length > 0 ? `默认分类已更新：${parts.join('；')}。` : '默认分类已是最新。'
}

/** 应用启动时检查默认分类版本并执行迁移；删除类操作先弹窗确认。 */
export default function DefaultCategoryMigrationGate() {
  const toast = useToast()
  const [plan, setPlan] = useState<MigrationPlan | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await seedIfEmpty()
        const p = await planDefaultCategoryMigrations()
        if (cancelled) return
        if (!p) return
        if (!p.hasChanges) {
          // 迁移清单没有可执行的剩余项（例如用户已自行改名）→ 直接推进版本，避免每次启动重复检查
          await finalizeDefaultCategoryMigrations([], [])
          return
        }
        setPlan(p)
        if (p.pendingRemovals.length > 0) {
          setOpen(true)
        } else {
          await finalizeDefaultCategoryMigrations([], [])
          toast.push('info', summary(p, []))
        }
      } catch {
        // 迁移失败不阻塞应用；版本号未推进，下次启动会重试
      }
    })()
    return () => {
      cancelled = true
    }
  }, [toast])

  async function respond(accept: boolean) {
    if (!plan) return
    setBusy(true)
    try {
      const keys = plan.pendingRemovals.map((r) => r.key)
      await finalizeDefaultCategoryMigrations(accept ? keys : [], accept ? [] : keys)
      toast.push('info', summary(plan, accept ? plan.pendingRemovals.map((r) => r.name) : []))
      setOpen(false)
      setPlan(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title="更新默认分类"
      message={
        plan
          ? `检测到默认分类更新。以下分类当前未被演出使用，将被删除：${plan.pendingRemovals
              .map((r) => `「${r.name}」`)
              .join('、')}。是否确认删除？`
          : ''
      }
      confirmText="确认删除"
      cancelText="暂不删除"
      danger
      busy={busy}
      onConfirm={() => void respond(true)}
      onClose={() => void respond(false)}
    />
  )
}
