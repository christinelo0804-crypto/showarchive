/** 主题对应的状态栏颜色（iOS 状态栏/灵动岛区域背景）。 */
const THEME_COLORS: Record<'dark' | 'light', string> = {
  dark: '#141422',
  light: '#efe9dd'
}

/** 应用主题并同步 iOS 状态栏颜色。 */
export function applyTheme(next: 'dark' | 'light'): void {
  document.documentElement.dataset.theme = next
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) {
    meta.content = THEME_COLORS[next]
  }
}
