import { useEffect, useState } from 'react'
import type { ImageAsset } from '../types'

export function ImagePreview({
  asset,
  alt,
  className,
  preferThumb = false
}: {
  asset: ImageAsset
  alt?: string
  className?: string
  /** 小尺寸场景（日历格子、抽屉缩略图）优先用 400px 缩略图，避免解码大图卡顿 */
  preferThumb?: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const source = preferThumb ? (asset.thumbnail ?? asset.display) : (asset.display ?? asset.thumbnail)
    if (!source) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(source)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [asset, preferThumb])
  return url ? <img className={className} src={url} alt={alt ?? ''} /> : null
}
