import { useEffect, useMemo, useRef, useState } from 'react'
import { QUOTES } from '../lib/quotes'
import type { Quote } from '../lib/quotes'
import curtainUrl from '../assets/splash-curtain.jpg'

function sizeClass(length: number): 'short' | 'medium' | 'long' {
  if (length <= 16) return 'short'
  if (length <= 42) return 'medium'
  return 'long'
}

/**
 * 台词按语言分别指定字体。
 * 原来所有语言共用一条字体栈，里面混了中文和韩文字体；在 iPhone 上汉字会落到
 * 韩文字体 Apple SD Gothic Neo，它只有繁体体系字形，碰到简体字继续回退到系统
 * 兜底字体，于是同一句里个别字明显更大。分语言后中文台词永远走中文字体。
 */
const QUOTE_FONTS: Record<string, { className: string; lang: string }> = {
  中文: { className: 'lang-zh', lang: 'zh' },
  韩语: { className: 'lang-ko', lang: 'ko' },
  英语: { className: 'lang-latin', lang: 'en' },
  法语: { className: 'lang-latin', lang: 'fr' },
  德语: { className: 'lang-latin', lang: 'de' },
  俄语: { className: 'lang-latin', lang: 'ru' },
}

function quoteFont(lang: string): { className: string; lang: string } {
  // 未知语言落到拉丁字体栈，并交给 lang 属性让系统按语言挑兜底字体
  return QUOTE_FONTS[lang] ?? { className: 'lang-latin', lang: '' }
}

export function Splash({ onDone }: { onDone: () => void }) {
  const quote = useMemo<Quote>(
    () => QUOTES[Math.floor(Math.random() * QUOTES.length)],
    []
  )
  const showTrans = quote.lang !== '中文' && quote.lang !== '英语' && Boolean(quote.translation)
  const size = sizeClass(quote.original.length)
  const font = quoteFont(quote.lang)
  const [phase, setPhase] = useState<'closed' | 'opening' | 'leaving'>('closed')
  const doneRef = useRef(false)
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  // 启动页展示期间锁定页面滚动，避免出现滚动条
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const delay = reduced ? 2400 : 3000
    const timer = window.setTimeout(() => setPhase(reduced ? 'leaving' : 'opening'), delay)
    return () => window.clearTimeout(timer)
  }, [reduced])

  useEffect(() => {
    if (phase !== 'opening' && phase !== 'leaving') return
    const delay = reduced ? 350 : 1400
    const timer = window.setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true
        onDone()
      }
    }, delay)
    return () => window.clearTimeout(timer)
  }, [phase, reduced, onDone])

  function finish() {
    if (!doneRef.current) {
      doneRef.current = true
      onDone()
    }
  }

  return (
    <div className={`splash ${phase} ${reduced ? 'splash-reduced' : ''}`}>
      <img
        className="splash-curtain-left"
        src={curtainUrl}
        alt=""
        decoding="async"
        fetchPriority="high"
        draggable={false}
      />
      <img
        className="splash-curtain-right"
        src={curtainUrl}
        alt=""
        decoding="async"
        fetchPriority="high"
        draggable={false}
      />
      <div className="splash-bloom" />
      <div className="splash-quote-wrap">
        <div className={`splash-quote size-${size}`}>
          <blockquote>
            <p className={`quote-original ${font.className}`} lang={font.lang || undefined}>
              {quote.original}
            </p>
            {showTrans && <p className="quote-trans">{quote.translation}</p>}
          </blockquote>
          <figcaption className="quote-source">——{quote.play}</figcaption>
        </div>
      </div>
      <button type="button" className="splash-skip" onClick={finish}>
        跳过
      </button>
    </div>
  )
}
