const CATEGORY_COLORS: Record<string, [string, string]> = {
  戏剧: ['#5a2d2d', '#2c1010'],
  演唱会: ['#6b4a28', '#2c1d0c'],
  音乐会: ['#24405a', '#101f2e'],
  语言节目: ['#4a3a5e', '#221630'],
  体育比赛: ['#1f4a45', '#0d2623']
}

const FALLBACK_COLORS: Array<[string, string]> = [
  ['#5a2d2d', '#2c1010'],
  ['#24405a', '#101f2e'],
  ['#4a3a5e', '#221630'],
  ['#1f4a45', '#0d2623'],
  ['#6b4a28', '#2c1d0c'],
  ['#4a243a', '#24101c'],
  ['#3a4a5a', '#18242e']
]

/** 无海报演出的自动封面配色：一级类别优先，未知分类回退标题哈希（同一演出始终同色）。 */
export function coverColors(title: string, categoryName: string): [string, string] {
  const byCategory = CATEGORY_COLORS[categoryName]
  if (byCategory) return byCategory
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

export type CoverSize = 'short' | 'mid' | 'tall'

export function coverSize(title: string): CoverSize {
  const len = title.length
  if (len <= 4) return 'short'
  if (len <= 10) return 'mid'
  return 'tall'
}
