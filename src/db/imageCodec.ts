import type { ImageAsset, Show } from '../types'

/**
 * iOS Safari 的 IndexedDB 对直接存储 Blob（图片）支持不可靠（WebKit 已知问题），
 * 写入数据库前把图片转成 ArrayBuffer，读取时再转回 Blob。
 * UI 层始终操作 Blob，存储层始终使用 ArrayBuffer。
 */

export interface StoredImageAsset {
  thumbnail?: ArrayBuffer
  display?: ArrayBuffer
  contentType: string
  width?: number
  height?: number
}

export type StoredShow = Omit<Show, 'poster' | 'ticketImage' | 'seatViewImage' | 'noteImages'> & {
  poster?: StoredImageAsset
  ticketImage?: StoredImageAsset
  seatViewImage?: StoredImageAsset
  noteImages?: StoredImageAsset[]
}

function decodeImage(stored?: StoredImageAsset | ImageAsset): ImageAsset | undefined {
  if (!stored) return undefined
  const contentType = stored.contentType
  const thumbnail =
    stored.thumbnail instanceof Blob
      ? stored.thumbnail
      : stored.thumbnail
        ? new Blob([stored.thumbnail], { type: contentType })
        : undefined
  const display =
    stored.display instanceof Blob
      ? stored.display
      : stored.display
        ? new Blob([stored.display], { type: contentType })
        : undefined
  return { thumbnail, display, contentType, width: stored.width, height: stored.height }
}

/** 读取数据库后调用（同步）：ArrayBuffer → Blob，兼容旧版直接存 Blob 的数据。 */
export function decodeShow(stored: StoredShow | Show): Show {
  return {
    ...stored,
    poster: decodeImage(stored.poster),
    ticketImage: decodeImage(stored.ticketImage),
    seatViewImage: decodeImage(stored.seatViewImage),
    noteImages: (stored.noteImages ?? [])
      .map((a) => decodeImage(a))
      .filter((a): a is ImageAsset => a != null)
  }
}

async function encodeImage(
  asset: ImageAsset | StoredImageAsset | undefined
): Promise<StoredImageAsset | undefined> {
  if (!asset) return undefined
  const toBuffer = async (v: Blob | ArrayBuffer | undefined): Promise<ArrayBuffer | undefined> => {
    if (!v) return undefined
    return v instanceof Blob ? v.arrayBuffer() : v
  }
  const [thumbnail, display] = await Promise.all([toBuffer(asset.thumbnail), toBuffer(asset.display)])
  return { thumbnail, display, contentType: asset.contentType, width: asset.width, height: asset.height }
}

/** 写入数据库前调用（异步）：Blob → ArrayBuffer；已是 ArrayBuffer 时原样保留。 */
export async function encodeShow(show: Show | StoredShow): Promise<StoredShow> {
  const [poster, ticketImage, seatViewImage, noteImages] = await Promise.all([
    encodeImage(show.poster),
    encodeImage(show.ticketImage),
    encodeImage(show.seatViewImage),
    Promise.all((show.noteImages ?? []).map((a) => encodeImage(a)))
  ])
  return {
    ...show,
    poster,
    ticketImage,
    seatViewImage,
    noteImages: noteImages.filter((a): a is StoredImageAsset => a != null)
  }
}
