import { ImagePreview } from './ImagePreview'
import { cropImageStyle, resolveCrop } from '../lib/posterCrop'
import type { ImageAsset, PosterCrop } from '../types'

/**
 * 固定比例里的海报缩略图：按裁切设置呈现（与首页网格一致）。
 * 「完整显示」时用同一张海报的模糊放大版填充留白；「裁切填充」时按平移/缩放取景。
 */
export function PosterThumb({
  poster,
  posterCrop,
  title,
  className
}: {
  poster?: ImageAsset
  /** 手动裁切设置；为空表示按宽高比自动判断 */
  posterCrop?: PosterCrop | null
  title?: string
  className: string
}) {
  if (!poster) return null
  const crop = resolveCrop({ poster, posterCrop: posterCrop ?? undefined })
  const style = cropImageStyle(crop)

  if (crop.mode === 'fit') {
    return (
      <>
        <ImagePreview asset={poster} alt="" className="thumb-fit-bg" preferThumb />
        <ImagePreview
          asset={poster}
          alt={title ?? ''}
          className={`${className} thumb-fit-fg`}
          style={style}
          preferThumb
        />
      </>
    )
  }

  return <ImagePreview asset={poster} alt={title ?? ''} className={className} style={style} preferThumb />
}
