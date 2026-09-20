import type { CSSProperties } from 'react'
import type { ImageAsset, PosterCrop } from '../types'

/**
 * 横版判定阈值（宽 / 高）。2:3 的格子用 cover 裁切时，
 * 宽高比超过该值后保留的画面不足 60%，改为「完整显示 + 模糊填充」。
 */
export const WIDE_RATIO = 1.11

/** 默认裁切：居中、不缩放。 */
export const DEFAULT_CROP: PosterCrop = { mode: 'cover', x: 50, y: 50, scale: 1 }

/** 自动规则：明显横版 → 完整显示；否则居中裁切。 */
export function autoCropMode(poster?: ImageAsset): PosterCrop['mode'] {
  const width = poster?.width
  const height = poster?.height
  if (!width || !height) return 'cover'
  return width / height > WIDE_RATIO ? 'fit' : 'cover'
}

/** 一条记录最终使用的裁切：手动设置优先，否则按自动规则。 */
export function resolveCrop(show: { poster?: ImageAsset; posterCrop?: PosterCrop }): PosterCrop {
  if (show.posterCrop) return show.posterCrop
  return { ...DEFAULT_CROP, mode: autoCropMode(show.poster) }
}

/** 海报的宽高比（拿不到尺寸时按 2:3 处理）。 */
export function posterRatio(poster?: ImageAsset): number {
  const width = poster?.width
  const height = poster?.height
  if (!width || !height) return 2 / 3
  return width / height
}

/** 把裁切设置转成图片的内联样式（缩略图与网格共用）。 */
export function cropImageStyle(crop: PosterCrop): CSSProperties {
  return {
    objectFit: crop.mode === 'fit' ? 'contain' : 'cover',
    objectPosition: `${crop.x}% ${crop.y}%`,
    transform: crop.scale !== 1 ? `scale(${crop.scale})` : undefined
  }
}
