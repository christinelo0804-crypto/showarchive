export interface ProcessedImage {
  thumbnail: Blob
  display: Blob
  contentType: string
  width: number
  height: number
}

const THUMB_EDGE = 400
const DISPLAY_EDGE = 1600
const QUALITY = 0.85

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败'))
    }
    img.src = url
  })
}

async function scaleToBlob(
  file: Blob,
  maxEdge: number,
  type: string,
  quality: number
): Promise<{ blob: Blob; width: number; height: number }> {
  let source: ImageBitmap | HTMLImageElement
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    source = await loadImage(file)
  }

  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.drawImage(source, 0, 0, width, height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('图片压缩失败'))),
      type,
      quality
    )
  })

  if ('close' in source) source.close()
  return { blob, width, height }
}

/**
 * 将用户选择的图片压缩为「展示图 + 缩略图」两层。
 * PNG 保持透明，其余格式统一转为 JPEG。
 */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  const contentType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const thumbnail = await scaleToBlob(file, THUMB_EDGE, contentType, QUALITY)
  const display = await scaleToBlob(file, DISPLAY_EDGE, contentType, QUALITY)
  return {
    thumbnail: thumbnail.blob,
    display: display.blob,
    contentType,
    width: display.width,
    height: display.height
  }
}
