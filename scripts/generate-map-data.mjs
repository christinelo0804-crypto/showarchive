// 生成地图打卡所需的两份内置数据：
//   1) src/lib/worldMapPath.ts —— 世界陆地轮廓（Natural Earth 110m，公有领域）
//   2) src/lib/mapCities.ts    —— 内置城市清单（名称 / 别名 / 经纬度）
// 运行：node scripts/generate-map-data.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// ---------- 投影参数（与 src/lib/mapGeo.ts 保持一致） ----------
// x = (lon + 180) / 360 * 1000；y = (78 - lat) / (78 - -45) * 340
const W = 1000
const H = 340
const LAT_TOP = 78
const LAT_BOTTOM = -45

const px = (lon) => ((lon + 180) / 360) * W
const py = (lat) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H

// ---------- 1. 世界陆地轮廓 ----------
const topo = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'land-110m.json'), 'utf8'))
const [sx, sy] = topo.transform.scale
const [tx, ty] = topo.transform.translate
const arcs = topo.arcs.map((arc) => {
  let x = 0
  let y = 0
  return arc.map(([dx, dy]) => {
    x += dx
    y += dy
    return [x * sx + tx, y * sy + ty]
  })
})

function ringPoints(indices) {
  const points = []
  for (const index of indices) {
    const arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index]
    if (points.length === 0) points.push(...arc)
    else points.push(...arc.slice(1))
  }
  return points
}

/**
 * 按 180° 经线切开环：跨经线的多边形（俄罗斯、斐济等）投影后会从右边缘
 * 直接连到左边缘，画出贯穿整张图的长横线，填充也会出现横条。
 * 这里把这类环拆成两段，各自闭合（闭合边落在图的两侧边缘，不影响观感）。
 */
function splitAtAntimeridian(points) {
  const parts = []
  let current = []
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const previous = points[i - 1]
    if (previous && Math.abs(point[0] - previous[0]) > 180) {
      if (current.length > 0) parts.push(current)
      current = []
    }
    current.push(point)
  }
  if (current.length > 0) parts.push(current)
  if (parts.length > 1) {
    const first = parts[0]
    const last = parts[parts.length - 1]
    if (Math.abs(first[0][0] - last[last.length - 1][0]) > 180) {
      parts[0] = [...last, ...first]
      parts.pop()
    }
  }
  return parts.filter((part) => part.length > 2)
}

const rings = []
for (const geometry of topo.objects.land.geometries) {
  const polygons = geometry.type === 'Polygon' ? [geometry.arcs] : geometry.arcs
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const part of splitAtAntimeridian(ringPoints(ring))) rings.push(part)
    }
  }
}

const segments = []
let longestJump = 0
for (const ring of rings) {
  const projected = ring.map(([lon, lat]) => [px(lon), py(lat)])
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of projected) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  // 丢掉过小的岛屿，控制体积（视口 1000×340 下面积小于 3 平方单位的基本看不见）
  if ((maxX - minX) * (maxY - minY) < 3) continue
  // 丢完全在视口外的部分（视口只到南纬 45°，南极洲整块用不到）
  if (maxY < 0 || minY > H || maxX < 0 || minX > W) continue
  for (let i = 1; i < projected.length; i++) {
    longestJump = Math.max(longestJump, Math.abs(projected[i][0] - projected[i - 1][0]))
  }
  const d = projected
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join('')
  segments.push(`${d}Z`)
}

const pathFile = `// 自动生成：node scripts/generate-map-data.mjs（数据源：scripts/data/land-110m.json，Natural Earth 公有领域）

/** 世界陆地轮廓（等距圆柱投影，视口 1000×340） */
export const WORLD_LAND_PATH =
  '${segments.join(' ')}'

/** 地图视口尺寸（与轮廓数据同一坐标系） */
export const MAP_VIEW_W = ${W}
export const MAP_VIEW_H = ${H}
/** 极点对应的纬度（用于经纬度 <-> 视口坐标换算） */
export const MAP_LAT_TOP = ${LAT_TOP}
export const MAP_LAT_BOTTOM = ${LAT_BOTTOM}
`
writeFileSync(join(root, 'src', 'lib', 'worldMapPath.ts'), pathFile)

// ---------- 2. 内置城市清单 ----------
// 格式：[中文名, 经度, 纬度, 额外别名（用 | 分隔）]
const CITY_ROWS = [
  // 中国内地
  ['北京', 116.4, 39.9, 'Beijing|Peking'],
  ['上海', 121.47, 31.23, 'Shanghai'],
  ['广州', 113.26, 23.13, 'Guangzhou|Canton'],
  ['深圳', 114.06, 22.54, 'Shenzhen'],
  ['成都', 104.07, 30.67, 'Chengdu'],
  ['重庆', 106.55, 29.56, 'Chongqing'],
  ['杭州', 120.15, 30.27, 'Hangzhou'],
  ['南京', 118.79, 32.06, 'Nanjing'],
  ['武汉', 114.3, 30.59, 'Wuhan'],
  ['西安', 108.94, 34.34, "Xi'an|Xian"],
  ['天津', 117.2, 39.13, 'Tianjin'],
  ['苏州', 120.62, 31.3, 'Suzhou'],
  ['长沙', 112.98, 28.19, 'Changsha'],
  ['郑州', 113.63, 34.75, 'Zhengzhou'],
  ['青岛', 120.38, 36.07, 'Qingdao'],
  ['厦门', 118.09, 24.48, 'Xiamen'],
  ['昆明', 102.83, 24.88, 'Kunming'],
  ['沈阳', 123.43, 41.8, 'Shenyang'],
  ['哈尔滨', 126.53, 45.8, 'Harbin'],
  ['大连', 121.61, 38.91, 'Dalian'],
  ['佛山', 113.12, 23.02, 'Foshan'],
  ['东莞', 113.75, 23.02, 'Dongguan'],
  ['珠海', 113.55, 22.27, 'Zhuhai'],
  ['南宁', 108.37, 22.82, 'Nanning'],
  // 港澳台
  ['香港', 114.17, 22.32, 'Hong Kong|HongKong'],
  ['澳门', 113.54, 22.2, 'Macau|Macao'],
  ['台北', 121.56, 25.03, 'Taipei'],
  ['高雄', 120.3, 22.63, 'Kaohsiung'],
  // 日本
  ['东京', 139.69, 35.69, 'Tokyo'],
  ['横滨', 139.64, 35.44, 'Yokohama'],
  ['埼玉', 139.65, 35.86, 'Saitama|さいたま'],
  ['大阪', 135.5, 34.69, 'Osaka'],
  ['名古屋', 136.91, 35.18, 'Nagoya'],
  ['京都', 135.77, 35.01, 'Kyoto'],
  // 韩国
  ['首尔', 126.98, 37.57, 'Seoul'],
  ['仁川', 126.71, 37.46, 'Incheon|Inchon'],
  ['釜山', 129.08, 35.18, 'Busan|Pusan'],
  // 东南亚
  ['新加坡', 103.82, 1.35, 'Singapore'],
  ['曼谷', 100.5, 13.75, 'Bangkok'],
  ['吉隆坡', 101.69, 3.14, 'Kuala Lumpur|KualaLumpur|KL'],
  ['雅加达', 106.85, -6.21, 'Jakarta'],
  // 欧洲
  ['布拉格', 14.42, 50.09, 'Prague|Praha'],
  ['伦敦', -0.13, 51.51, 'London'],
  ['巴黎', 2.35, 48.86, 'Paris'],
  ['柏林', 13.4, 52.52, 'Berlin'],
  ['慕尼黑', 11.58, 48.14, 'Munich|Muenchen'],
  ['维也纳', 16.37, 48.21, 'Vienna|Wien'],
  ['苏黎世', 8.54, 47.38, 'Zurich'],
  ['阿姆斯特丹', 4.9, 52.37, 'Amsterdam'],
  ['米兰', 9.19, 45.46, 'Milan|Milano'],
  ['罗马', 12.5, 41.9, 'Rome|Roma'],
  ['马德里', -3.7, 40.42, 'Madrid'],
  ['巴塞罗那', 2.17, 41.39, 'Barcelona'],
  // 北美
  ['纽约', -74.01, 40.71, 'New York|NewYork|NYC'],
  ['洛杉矶', -118.24, 34.05, 'Los Angeles|LosAngeles|LA'],
  ['旧金山', -122.42, 37.77, 'San Francisco|SanFrancisco|SF'],
  ['芝加哥', -87.63, 41.88, 'Chicago'],
  ['多伦多', -79.38, 43.65, 'Toronto'],
  // 大洋洲
  ['悉尼', 151.21, -33.87, 'Sydney'],
  ['奥克兰', 174.76, -36.85, 'Auckland']
]

const cities = CITY_ROWS.map(([name, lon, lat, extra]) => ({
  name,
  lon,
  lat,
  aliases: [...extra.split('|'), `${name}市`].filter(Boolean)
}))

const citiesFile = `// 自动生成：node scripts/generate-map-data.mjs（要增删城市请改脚本里的 CITY_ROWS 后重跑）

export interface MapCity {
  /** 中文名，用于地图与清单展示 */
  name: string
  /** 经度（东经为正） */
  lon: number
  /** 纬度（北纬为正） */
  lat: number
  /** 其它写法：英文名、别称；匹配时与中文名一起参与 */
  aliases: string[]
}

export const MAP_CITIES: MapCity[] = ${JSON.stringify(cities, null, 2)}
`
writeFileSync(join(root, 'src', 'lib', 'mapCities.ts'), citiesFile)

console.log(
  `陆地轮廓 ${segments.length} 段（${pathFile.length} 字节），环内最大横向跳变 ${longestJump.toFixed(1)} 视口单位；城市 ${cities.length} 个（${citiesFile.length} 字节）`
)
