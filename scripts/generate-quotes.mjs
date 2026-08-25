// 从 ShowArchive/戏剧台词列表.md 生成应用内置台词数据（src/lib/quotes.ts）
// 运行：node scripts/generate-quotes.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// 优先取「showarchive-app 同级」的旧位置；部署包内则取仓库根目录的 md
const mdCandidates = [join(root, '..', '戏剧台词列表.md'), join(root, '戏剧台词列表.md')]
const outPath = join(root, 'src', 'lib', 'quotes.ts')

let mdContent
for (const mdPath of mdCandidates) {
  try {
    mdContent = readFileSync(mdPath, 'utf8')
    break
  } catch {
    // 继续尝试下一个位置
  }
}
if (!mdContent) {
  console.warn(`[generate-quotes] 未找到数据源（已尝试 ${mdCandidates.join('、')}），跳过生成，保留现有 quotes.ts`)
  process.exit(0)
}
const lines = mdContent.split('\n')
const rows = []
for (const line of lines) {
  if (!line.trim().startsWith('|')) continue
  const cells = line
    .split('|')
    .map((c) => c.trim())
    .slice(1, 6)
  if (cells.length < 5) continue
  const [lang, original, translation, play, song] = cells
  if (!original || original === '原句' || original === '---' || original.startsWith('---')) continue
  rows.push({
    lang,
    original: original.replace(/<br\s*\/?>/gi, '\n'),
    translation: translation.replace(/<br\s*\/?>/gi, '\n'),
    play,
    song
  })
}

const entries = rows.map((r) => `  ${JSON.stringify(r)}`).join(',\n')
const content = `// 自动生成：node scripts/generate-quotes.mjs（数据源：ShowArchive/戏剧台词列表.md）

export interface Quote {
  lang: string
  original: string
  translation: string
  play: string
  song: string
}

export const QUOTES: Quote[] = [
${entries}
]
`

writeFileSync(outPath, content)
console.log(`Generated ${rows.length} quotes -> src/lib/quotes.ts`)
