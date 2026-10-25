import { PAPERS } from './papers.js'

/** Space (mm) reserved outside the bleed for crop marks. */
export const SLUG = 8
export const MAX_DOTS = 250_000
const MIN_SPACING = 0.5

const pos = (v, fallback = 0) => (Number.isFinite(v) && v >= 0 ? v : fallback)

export function trimSize(s) {
  if (s.paper === 'custom') return { w: pos(s.customWidth, 210) || 210, h: pos(s.customHeight, 297) || 297 }
  const [a, b] = (PAPERS[s.paper] ?? PAPERS.A4).size
  return s.orientation === 'landscape' ? { w: b, h: a } : { w: a, h: b }
}

export function margins(s) {
  const all = pos(s.marginTop)
  const m = s.linkMargins
    ? { top: all, right: all, bottom: all, left: all }
    : { top: all, right: pos(s.marginRight), bottom: pos(s.marginBottom), left: pos(s.marginLeft) }
  m.left += pos(s.gutter)
  return m
}

export function spacing(s) {
  const x = Math.max(MIN_SPACING, pos(s.spacingX, 5))
  const y = s.linkSpacing ? x : Math.max(MIN_SPACING, pos(s.spacingY, 5))
  return { x, y }
}

/**
 * Lays out the page in millimetres. Every renderer (SVG, canvas, PDF)
 * draws from this one description so previews and exports always match.
 */
export function buildScene(s) {
  const { w, h } = trimSize(s)
  const bleed = pos(s.bleed)
  const slug = s.cropMarks ? SLUG : 0
  const off = bleed + slug
  const width = w + 2 * off
  const height = h + 2 * off

  const trim = { x: off, y: off, w, h }
  const bleedBox = { x: slug, y: slug, w: w + 2 * bleed, h: h + 2 * bleed }
  const m = margins(s)
  const marginBox = { x: off + m.left, y: off + m.top, w: w - m.left - m.right, h: h - m.top - m.bottom }
  const area = s.fillBleed ? bleedBox : marginBox
  const sp = spacing(s)

  const scene = {
    width, height, trim, bleedBox, marginBox, area,
    shape: s.shape,
    opacity: Math.min(1, pos(s.opacity, 1)),
    background: s.background,
    solid: s.colorMode === 'solid' ? s.color : null,
    dots: [], lines: [], cols: 0, rows: 0, tooMany: false, empty: false,
  }

  if (area.w < 0 || area.h < 0) {
    scene.empty = true
  } else {
    const cols = Math.floor(area.w / sp.x + 1e-6) + 1
    const rows = Math.floor(area.h / sp.y + 1e-6) + 1
    scene.cols = cols
    scene.rows = rows
    if (cols * rows > MAX_DOTS) scene.tooMany = true
    else scene.dots = layoutDots(s, area, sp, cols, rows)
  }

  if (s.cropMarks) scene.lines = cropMarks(trim, off, Math.max(bleed, 2))
  return scene
}

function layoutDots(s, area, sp, cols, rows) {
  const centered = s.align === 'center'
  const ox = centered ? (area.w - (cols - 1) * sp.x) / 2 : 0
  const oy = centered ? (area.h - (rows - 1) * sp.y) / 2 : 0
  const r = Math.max(0.025, pos(s.dotSize, 0.6)) / 2
  const majorR = r * Math.max(0.1, pos(s.majorScale, 1))
  const every = Math.floor(pos(s.majorEvery))
  // When centered, anchor emphasized dots on the middle dot so the pattern stays symmetric.
  const ci = centered ? Math.floor((cols - 1) / 2) : 0
  const cj = centered ? Math.floor((rows - 1) / 2) : 0
  const isMajor = (i, c) => every > 1 && (((i - c) % every) + every) % every === 0
  const color = colorFn(s, area)

  const dots = new Array(cols * rows)
  let n = 0
  for (let j = 0; j < rows; j++) {
    const y = area.y + oy + j * sp.y
    const majorRow = isMajor(j, cj)
    for (let i = 0; i < cols; i++) {
      const x = area.x + ox + i * sp.x
      dots[n++] = {
        x, y,
        r: majorRow && isMajor(i, ci) ? majorR : r,
        fill: color ? color(x, y) : null,
      }
    }
  }
  return dots
}

function cropMarks(trim, off, gap) {
  const lines = []
  for (const [cx, dx] of [[trim.x, -1], [trim.x + trim.w, 1]]) {
    for (const [cy, dy] of [[trim.y, -1], [trim.y + trim.h, 1]]) {
      lines.push({ x1: cx + dx * gap, y1: cy, x2: cx + dx * (off - 1), y2: cy })
      lines.push({ x1: cx, y1: cy + dy * gap, x2: cx, y2: cy + dy * (off - 1) })
    }
  }
  return lines
}

/** Outline of a non-round dot as absolute points, or null for circles. */
export function polygon(shape, x, y, r) {
  switch (shape) {
    case 'square':
      return [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]]
    case 'diamond':
      return [[x, y - r], [x + r, y], [x, y + r], [x - r, y]]
    case 'hex':
      return Array.from({ length: 6 }, (_, k) => {
        const a = ((-90 + 60 * k) * Math.PI) / 180
        return [x + r * Math.cos(a), y + r * Math.sin(a)]
      })
    default:
      return null
  }
}

// --- Color ---------------------------------------------------------------

export function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

const toHex = (rgb) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')

function colorFn(s, box) {
  if (s.colorMode === 'solid') return null
  const a = hexToRgb(s.color)
  const b = hexToRgb(s.colorEnd)
  const mix = (t) => {
    const k = Math.min(1, Math.max(0, t))
    return toHex(a.map((c, i) => c + (b[i] - c) * k))
  }

  if (s.colorMode === 'radial') {
    const cx = box.x + box.w / 2
    const cy = box.y + box.h / 2
    const R = Math.hypot(box.w / 2, box.h / 2) || 1
    return (x, y) => mix(Math.hypot(x - cx, y - cy) / R)
  }

  // Linear: 0° runs left → right, 90° top → bottom.
  const rad = (pos(s.gradientAngle) * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const proj = [
    [box.x, box.y], [box.x + box.w, box.y],
    [box.x, box.y + box.h], [box.x + box.w, box.y + box.h],
  ].map(([x, y]) => x * dx + y * dy)
  const min = Math.min(...proj)
  const range = Math.max(...proj) - min || 1
  return (x, y) => mix((x * dx + y * dy - min) / range)
}
