import { useEffect, useState } from 'react'
import type { ImageAsset } from '../types'

// 模块级图片链接缓存：同一 Blob 只生成一次 ObjectURL，
// 避免列表/日历/时间线频繁挂载时重复创建与解码。
const imageUrlCache = new WeakMap<Blob, string>()

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
    const cached = imageUrlCache.get(source)
    if (cached) {
      setUrl(cached)
      return
    }
    const u = URL.createObjectURL(source)
    imageUrlCache.set(source, u)
    setUrl(u)
  }, [asset, preferThumb])
  return url ? <img className={className} src={url} alt={alt ?? ''} /> : null
}
