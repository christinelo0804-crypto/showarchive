import { MAP_CITIES } from './mapCities'
import type { MapCity } from './mapCities'
import { MAP_LAT_BOTTOM, MAP_LAT_TOP, MAP_VIEW_H, MAP_VIEW_W } from './worldMapPath'

export type { MapCity }

export interface MapView {
  x: number
  y: number
  w: number
  h: number
}

/** 经纬度 → 地图坐标（与 worldMapPath 的轮廓数据同一坐标系） */
export function projectToMap(lon: number, lat: number): { x: number; y: number } {
  return {
    x: ((lon + 180) / 360) * MAP_VIEW_W,
    y: ((MAP_LAT_TOP - lat) / (MAP_LAT_TOP - MAP_LAT_BOTTOM)) * MAP_VIEW_H
  }
}

/** 整张世界地图 */
export const MAP_WORLD_VIEW: MapView = { x: 0, y: 0, w: MAP_VIEW_W, h: MAP_VIEW_H }

/** 由经纬度范围算出视图矩形 */
export function viewFromBounds(lonMin: number, lonMax: number, latMax: number, latMin: number): MapView {
  const topLeft = projectToMap(lonMin, latMax)
  const bottomRight = projectToMap(lonMax, latMin)
  return { x: topLeft.x, y: topLeft.y, w: bottomRight.x - topLeft.x, h: bottomRight.y - topLeft.y }
}

/**
 * 默认视图：中国内地东部 + 港澳台 + 首尔 + 东京。
 * 经纬度范围取 东经 94–149°、北纬 48–15°：
 *   · 西到昆明 / 成都（102.8°E / 104.1°E），东到东京（139.7°E），两侧留出边距；
 *   · 北到哈尔滨（45.8°N），南到三亚 / 香港（18.3°N / 22.3°N）；
 * 东西向刻意比覆盖范围宽约 11°（多出的部分落在西侧内陆与东侧太平洋），
 * 这样卡片更扁（高/宽 ≈ 0.60），视觉上不占高度；缩放或切换世界视图时尺寸不变。
 */
export const MAP_DEFAULT_VIEW: MapView = viewFromBounds(94, 149, 48, 15)

/**
 * 地图卡片固定的长宽比（高 / 宽）。
 * 按默认视图的长宽比定，缩放或双击切换世界视图时卡片尺寸不再变化；
 * 视图长宽比与卡片不一致时，SVG 用 meet 方式居中留边（卡片底色与地图底色一致，看不出接缝）。
 */
export const MAP_CARD_ASPECT = MAP_DEFAULT_VIEW.h / MAP_DEFAULT_VIEW.w

/** 最小视图宽度（约 25 倍放大） */
export const MAP_MIN_VIEW_W = 40

/**
 * 把视图限制在地图范围内，并不改变长宽比：
 * 卡片高度是按视图长宽比算的，所以缩放/平移后必须保持比例，否则底图会被拉变形。
 */
export function clampMapView(view: MapView): MapView {
  const aspect = view.h / view.w
  let w = Math.min(Math.max(view.w, MAP_MIN_VIEW_W), MAP_VIEW_W)
  let h = w * aspect
  if (h > MAP_VIEW_H) {
    h = MAP_VIEW_H
    w = h / aspect
  }
  const x = Math.min(Math.max(view.x, 0), Math.max(0, MAP_VIEW_W - w))
  const y = Math.min(Math.max(view.y, 0), Math.max(0, MAP_VIEW_H - h))
  return { x, y, w, h }
}

/** 以某个点为焦点缩放（factor < 1 为放大） */
export function zoomMapView(view: MapView, factor: number, focus: { x: number; y: number }): MapView {
  const next: MapView = {
    w: view.w * factor,
    h: view.h * factor,
    x: focus.x - (focus.x - view.x) * factor,
    y: focus.y - (focus.y - view.y) * factor
  }
  return clampMapView(next)
}

/** 平移（单位是地图坐标） */
export function panMapView(view: MapView, dx: number, dy: number): MapView {
  return clampMapView({ ...view, x: view.x + dx, y: view.y + dy })
}

/** 城市在地图上的坐标 */
export function cityMapPoint(city: MapCity): { x: number; y: number } {
  return projectToMap(city.lon, city.lat)
}

/** 归一化城市名：去空格、转小写、去掉「·」后面的行政区、去掉「市 / 地区」等后缀 */
function normalizeCityName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[·・/|—-].*$/u, '')
    .replace(/\s+/g, '')
    .replace(/(特别行政区|地区|自治州|市|省)$/u, '')
}

const CITY_INDEX = new Map<string, MapCity>()
for (const city of MAP_CITIES) {
  for (const name of [city.name, ...city.aliases]) {
    const key = normalizeCityName(name)
    if (key && !CITY_INDEX.has(key)) CITY_INDEX.set(key, city)
  }
}

/** 按用户填写的城市名匹配内置城市；未收录返回 null */
export function matchMapCity(rawName?: string | null): MapCity | null {
  if (!rawName) return null
  return CITY_INDEX.get(normalizeCityName(rawName)) ?? null
}

export const MAP_CITY_COUNT = MAP_CITIES.length
