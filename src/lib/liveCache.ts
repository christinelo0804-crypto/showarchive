import { useLiveQuery } from 'dexie-react-hooks'

// 模块级结果缓存：页面重新挂载（例如从详情页返回）时首帧就能拿到上次的数据，
// 避免先闪一下「读取中…」再渲染内容；实时查询返回新结果后会自动覆盖。
const cache = new Map<string, unknown>()

export function useCachedLiveQuery<T>(
  key: string,
  querier: () => Promise<T>,
  deps: unknown[] = []
): T | undefined {
  const result = useLiveQuery(querier, deps)
  if (result !== undefined) {
    cache.set(key, result)
    return result
  }
  return cache.get(key) as T | undefined
}
