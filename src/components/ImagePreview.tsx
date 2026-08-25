import { useEffect, useState } from 'react'
import type { ImageAsset } from '../types'

export function ImagePreview({ asset, alt, className }: { asset: ImageAsset; alt?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const source = asset.display ?? asset.thumbnail
    if (!source) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(source)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [asset])
  return url ? <img className={className} src={url} alt={alt ?? ''} /> : null
}
