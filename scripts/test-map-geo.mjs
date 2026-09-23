// 地图坐标与城市匹配自测：node scripts/test-map-geo.mjs
import { createServer } from 'vite'

const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error'
})

try {
  const geo = await server.ssrLoadModule('/src/lib/mapGeo.ts')
  const { projectToMap, viewFromBounds, clampMapView, zoomMapView, panMapView, matchMapCity, MAP_DEFAULT_VIEW, MAP_WORLD_VIEW, MAP_CITY_COUNT } =
    geo

  const fail = []
  const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol

  // 投影：上海 (121.47E, 31.23N) → 约 837.4 / 129.3（对应百分比 83.7% / 38.0%）
  const sh = projectToMap(121.47, 31.23)
  if (!near(sh.x, 837.4) || !near(sh.y, 129.3)) fail.push(`投影偏差：${JSON.stringify(sh)}`)

  // 默认视图（东亚）与世界视图
  if (!(MAP_DEFAULT_VIEW.w > 0 && MAP_DEFAULT_VIEW.h > 0)) fail.push('默认视图无效')
  if (MAP_WORLD_VIEW.w !== 1000 || MAP_WORLD_VIEW.h !== 340) fail.push('世界视图无效')
  const japan = viewFromBounds(128, 146, 46, 30)
  if (japan.w <= 0) fail.push('viewFromBounds 无效')

  // 边界限制：不越界、不变形
  const clamped = clampMapView({ x: -500, y: -500, w: 200, h: 200 })
  if (clamped.x < 0 || clamped.y < 0) fail.push(`clamp 未限制位置：${JSON.stringify(clamped)}`)
  if (Math.abs(clamped.h / clamped.w - 1) > 0.001) fail.push('clamp 改变了长宽比')
  const tooWide = clampMapView({ x: 0, y: 0, w: 5000, h: 5000 })
  if (tooWide.w > 1000 || tooWide.h > 340) fail.push(`clamp 未限制尺寸：${JSON.stringify(tooWide)}`)

  // 缩放：焦点保持不动
  const base = { x: 300, y: 100, w: 400, h: 136 }
  const focus = { x: 500, y: 160 }
  const zoomed = zoomMapView(base, 0.5, focus)
  const focusAfter = {
    x: zoomed.x + ((focus.x - base.x) / base.w) * zoomed.w,
    y: zoomed.y + ((focus.y - base.y) / base.h) * zoomed.h
  }
  if (!near(focusAfter.x, focus.x, 0.001) || !near(focusAfter.y, focus.y, 0.001)) {
    fail.push(`缩放焦点漂移：${JSON.stringify(focusAfter)}`)
  }
  if (!near(zoomed.w, 200) || !near(zoomed.h, 68)) fail.push(`缩放比例错误：${JSON.stringify(zoomed)}`)
  const panned = panMapView(base, 50, -20)
  if (!near(panned.x, 350) || !near(panned.y, 80)) fail.push(`平移错误：${JSON.stringify(panned)}`)

  // 城市匹配
  const cases = [
    ['上海', '上海'],
    ['上海市', '上海'],
    ['Shanghai', '上海'],
    ['上海·黄浦', '上海'],
    ['tokyo', '东京'],
    ['埼玉', '埼玉'],
    ['さいたま', '埼玉'],
    ['Saitama', '埼玉'],
    ['仁川', '仁川'],
    ['Incheon', '仁川'],
    ['New York', '纽约'],
    ['纽约市', '纽约'],
    ['香港', '香港'],
    ['Kuala Lumpur', '吉隆坡'],
    ['布拉格', '布拉格'],
    ['青森', null],
    ['纽伦堡', null],
    ['', null]
  ]
  for (const [input, expected] of cases) {
    const got = matchMapCity(input)?.name ?? null
    if (got !== expected) fail.push(`匹配「${input}」→ ${got}（期望 ${expected}）`)
  }

  console.log(`城市清单 ${MAP_CITY_COUNT} 个；用例 ${cases.length + 9} 项`)
  if (fail.length > 0) {
    console.error('❌ 未通过：\n' + fail.join('\n'))
    process.exitCode = 1
  } else {
    console.log('✅ 地图坐标与城市匹配全部通过')
  }
} finally {
  await server.close()
}
