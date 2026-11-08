/**
 * ============================================================
 *  coverArt.js —— 封面素材工具（本地生成 + 圆形裁切）
 * ------------------------------------------------------------
 *  本文件只负责「图的生产与加工」，不发任何网络请求：
 *    · 真实 AI 封面：由 AiCoverGen.vue 直接 POST /api/generate-cover
 *      （地址可用环境变量 VITE_COVER_API 覆盖），拿到图后再调 cropToCircle()。
 *    · 本地兜底：localCover() 用「确定性程序化 SVG 生成器」产出复古几何封面，
 *      纯前端、零依赖、离线可用，保证演示永不中断。
 *  两条通路的出口统一经过 cropToCircle() 裁成黑胶用的正圆封面。
 * ============================================================
 */

/* ------------------------- 工具 ------------------------- */

/** 字符串 → 32 位哈希，用作确定性随机种子 */
export function hashString(str = '') {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/** 种子随机数发生器（mulberry32），保证同一标题永远得到同一张封面 */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const escapeXml = (s = '') =>
  String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))

/* --------------------- 风格 → 调色板 --------------------- */

/**
 * 调色板统一在「品红 × 墨青黑 × 奶油黄」的主色关系内做变化，
 * 只靠第三个亮色（bright）拉开冷暖差异 —— 这样本地生成的封面
 * 贴到品红机身上不会打架，整体像同一套丝网印海报。
 * 三色依次是：暗底 / 中间调 / 亮色，全部取自全站色板。
 */
const PALETTES = [
  { name: 'amber', keys: ['lo-fi', 'lofi', '低保真', '爵士', 'jazz', '怀旧', 'warm'], c: ['#132a33', '#c92b7c', '#f5e6a8'] },
  { name: 'neon', keys: ['synth', '赛博', '霓虹', 'neon', '电音', 'synthwave', 'arcade'], c: ['#0a1a20', '#e8449b', '#9bebf5'] },
  { name: 'dusk', keys: ['日落', '黄昏', 'chill', 'sunset', '慵懒', 'downtempo'], c: ['#0a1a20', '#ee5c93', '#fbf0c4'] },
  { name: 'rain', keys: ['雨', '夜晚', 'night', 'rain', 'blue', '忧郁', 'lo-fi rain'], c: ['#132a33', '#a01b5e', '#9bebf5'] },
  { name: 'moss', keys: ['森林', '自然', 'forest', 'acoustic', '民谣', 'green'], c: ['#132a33', '#2fb4cc', '#f5e6a8'] },
  { name: 'rose', keys: ['city', '城市', '浪漫', 'romance', 'soul', 'r&b'], c: ['#2b0a1c', '#f2719f', '#fff6f9'] },
]

/** 按风格描述关键词匹配调色板，未命中则按种子取一套 */
export function pickPalette(style = '', seed = 0) {
  const s = String(style).toLowerCase()
  const hit = PALETTES.find((p) => p.keys.some((k) => s.includes(k)))
  if (hit) return hit
  return PALETTES[seed % PALETTES.length]
}

/* ------------------- 程序化 SVG 封面生成 ------------------- */

const SIZE = 480

/**
 * 生成一张复古几何封面（返回 SVG 源码字符串）。
 * 三种版式：retro-sunset / neon-grid / concentric-rings，由种子决定。
 */
export function proceduralCoverSvg({ title = 'UNTITLED', style = '', seed = 1 } = {}) {
  const rnd = mulberry32(seed)
  const pal = pickPalette(style, seed)
  const [dark, mid, bright] = pal.c
  const variant = seed % 3
  const parts = []

  parts.push(
    `<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>`
  )

  if (variant === 0) {
    // 复古落日：横条 + 半圆日轮
    const cx = SIZE * (0.3 + rnd() * 0.4)
    const cy = SIZE * (0.36 + rnd() * 0.12)
    const r = SIZE * (0.16 + rnd() * 0.08)
    parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${bright}" opacity=".92"/>`)
    for (let i = 0; i < 6; i++) {
      const y = cy + r * 0.35 + i * (SIZE * 0.062)
      const h = SIZE * (0.012 + rnd() * 0.02)
      parts.push(`<rect x="0" y="${y.toFixed(1)}" width="${SIZE}" height="${h.toFixed(1)}" fill="${dark}" opacity="${(0.18 + i * 0.1).toFixed(2)}"/>`)
    }
  } else if (variant === 1) {
    // 霓虹网格：透视地平线 + 纵线
    const hy = SIZE * (0.58 + rnd() * 0.08) // 地平线
    parts.push(`<circle cx="${(SIZE / 2).toFixed(0)}" cy="${hy.toFixed(0)}" r="${(SIZE * 0.2).toFixed(0)}" fill="${bright}" opacity=".55"/>`)
    for (let i = -6; i <= 6; i++) {
      parts.push(
        `<line x1="${(SIZE / 2 + i * SIZE * 0.03).toFixed(1)}" y1="${hy.toFixed(1)}" x2="${(SIZE / 2 + i * SIZE * 0.34).toFixed(1)}" y2="${SIZE}" stroke="${bright}" stroke-width="2" opacity=".4"/>`
      )
    }
    for (let i = 0; i < 7; i++) {
      const y = hy + Math.pow(i / 7, 2.2) * (SIZE - hy)
      parts.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${SIZE}" y2="${y.toFixed(1)}" stroke="${bright}" stroke-width="2" opacity="${(0.12 + i * 0.06).toFixed(2)}"/>`)
    }
  } else {
    // 同心环：偏心圆环叠压
    const cx = SIZE * (0.3 + rnd() * 0.4)
    const cy = SIZE * (0.3 + rnd() * 0.4)
    for (let i = 8; i >= 1; i--) {
      parts.push(
        `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(i * SIZE * 0.055).toFixed(1)}" fill="none" stroke="${i % 2 ? bright : mid}" stroke-width="${(SIZE * 0.022).toFixed(1)}" opacity="${(0.2 + (9 - i) * 0.06).toFixed(2)}"/>`
      )
    }
  }

  // 颗粒质感：稀疏半透明光点
  for (let i = 0; i < 46; i++) {
    const x = rnd() * SIZE
    const y = rnd() * SIZE
    const r = 1 + rnd() * 5
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${bright}" opacity="${(0.05 + rnd() * 0.16).toFixed(2)}"/>`)
  }

  // 底部渐变压暗 + 标题
  parts.push(`<rect width="${SIZE}" height="${SIZE}" fill="url(#vig)"/>`)
  const label = escapeXml(title.trim().slice(0, 18) || 'UNTITLED').toUpperCase()
  // 封面文字：跟随全局无衬线规范，字距收紧，不做衬线装饰
  parts.push(
    `<text x="${SIZE * 0.06}" y="${SIZE * 0.93}" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="${(SIZE * 0.078).toFixed(0)}" letter-spacing="1" fill="#fff6f9" opacity=".95">${label}</text>`
  )
  parts.push(
    `<text x="${SIZE * 0.06}" y="${SIZE * 0.985}" font-family="Inter, system-ui, sans-serif" font-size="${(SIZE * 0.03).toFixed(0)}" letter-spacing="2" fill="#fff6f9" opacity=".6">${escapeXml((style || pal.name).slice(0, 26)).toUpperCase()}</text>`
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${mid}"/><stop offset="100%" stop-color="${dark}"/>
</linearGradient>
<radialGradient id="vig" cx="50%" cy="45%" r="72%">
<stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".55"/>
</radialGradient>
</defs>
${parts.join('\n')}
</svg>`
}

/** SVG 源码 → dataURL */
export function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** 本地兜底：同步产出一张圆形封面 */
export function localCover({ title, style, seed }) {
  return svgToDataUrl(proceduralCoverSvg({ title, style, seed }))
}

/* ------------------------- 圆形裁切 ------------------------- */

/**
 * 把任意图片裁成正圆形（四角透明）的 PNG。
 * 失败（如跨域污染画布）时静默返回原图 —— 渲染层还有 SVG clipPath 兜底。
 */
export function cropToCircle(src, size = 512) {
  return new Promise((resolve) => {
    const img = new Image()
    // 仅远程图片需要 CORS，data URL 设置 crossOrigin 反而可能在部分浏览器报错
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = size
        const ctx = c.getContext('2d')
        ctx.save()
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()
        // 居中铺满裁切，短边对齐
        const s = Math.max(size / img.width, size / img.height)
        const w = img.width * s
        const h = img.height * s
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        ctx.restore()
        resolve(c.toDataURL('image/png'))
      } catch {
        resolve(src)
      }
    }
    img.onerror = () => resolve(src)
    img.src = src
  })
}
