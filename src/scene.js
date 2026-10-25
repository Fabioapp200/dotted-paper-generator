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
 * Fits as many pages as possible on the chosen sheet, turning the sheet
 * whichever way holds more (A5 on A4 → landscape, 2 side by side).
 * Returns null when no sheet is chosen.
 */
export function impose(s, page = trimSize(s)) {
  const sheet = PAPERS[s.sheet]
  if (!sheet) return null
  const [a, b] = sheet.size
  const fit = (W, H) => ({ W, H, cols: Math.floor(W / page.w + 1e-6), rows: Math.floor(H / page.h + 1e-6) })
  const portrait = fit(a, b)
  const landscape = fit(b, a)
  const best = landscape.cols * landscape.rows > portrait.cols * portrait.rows ? landscape : portrait
  return {
    ...best,
    count: best.cols * best.rows,
    landscape: best.W > best.H,
    x0: (best.W - best.cols * page.w) / 2,
    y0: (best.H - best.rows * page.h) / 2,
  }
}

/**
 * Lays out the sheet in millimetres. Every renderer (SVG, canvas, PDF)
 * draws from this one description so previews and exports always match.
 */
export function buildScene(s) {
  const page = trimSize(s)
  const imp = impose(s, page)
  if (imp?.count) return imposedScene(s, page, imp)
  const scene = singleScene(s, page)
  scene.sheetTooSmall = !!imp
  return scene
}

function baseScene(s, width, height) {
  return {
    width, height,
    shape: s.shape,
    opacity: Math.min(1, pos(s.opacity, 1)),
    background: s.background,
    solid: s.colorMode === 'solid' ? s.color : null,
    dots: [], lines: [],
    // Preview-only overlays.
    guides: { bleed: null, trims: [], margins: [] },
    cols: 0, rows: 0, pages: 1, imposition: null,
    tooMany: false, empty: false, sheetTooSmall: false,
  }
}

function singleScene(s, { w, h }) {
  const bleed = pos(s.bleed)
  const slug = s.cropMarks ? SLUG : 0
  const off = bleed + slug
  const scene = baseScene(s, w + 2 * off, h + 2 * off)

  const trim = { x: off, y: off, w, h }
  const bleedBox = { x: slug, y: slug, w: w + 2 * bleed, h: h + 2 * bleed }
  const marginBox = insetBox(trim, margins(s))
  if (bleed) scene.guides.bleed = bleedBox
  if (off) scene.guides.trims.push(trim)
  scene.guides.margins.push(marginBox)

  fillPages(scene, s, [s.fillBleed ? bleedBox : marginBox])
  if (s.cropMarks) scene.lines = cropMarks(trim, off, Math.max(bleed, 2))
  return scene
}

function imposedScene(s, page, imp) {
  const scene = baseScene(s, imp.W, imp.H)
  scene.pages = imp.count
  scene.imposition = imp

  const base = margins(s)
  // In a folded spread the inside edge of an even column is its right side.
  const mirrored = { ...base, left: base.right, right: base.left }
  const areas = []
  for (let r = 0; r < imp.rows; r++) {
    for (let c = 0; c < imp.cols; c++) {
      const trim = { x: imp.x0 + c * page.w, y: imp.y0 + r * page.h, w: page.w, h: page.h }
      const marginBox = insetBox(trim, s.mirrorGutter && c % 2 === 0 && imp.cols > 1 ? mirrored : base)
      scene.guides.trims.push(trim)
      scene.guides.margins.push(marginBox)
      areas.push(s.fillBleed ? trim : marginBox)
    }
  }

  fillPages(scene, s, areas)
  scene.lines = sheetMarks(s.sheetMarks, imp, page, base)
  return scene
}

const insetBox = (b, m) => ({ x: b.x + m.left, y: b.y + m.top, w: b.w - m.left - m.right, h: b.h - m.top - m.bottom })

/** Fills each area with the dot grid. All areas share one size, so one grid count applies. */
function fillPages(scene, s, areas) {
  const area = areas[0]
  if (area.w < 0 || area.h < 0) {
    scene.empty = true
    return
  }
  const sp = spacing(s)
  scene.cols = Math.floor(area.w / sp.x + 1e-6) + 1
  scene.rows = Math.floor(area.h / sp.y + 1e-6) + 1
  if (scene.cols * scene.rows * areas.length > MAX_DOTS) {
    scene.tooMany = true
    return
  }
  for (const a of areas) layoutDots(scene.dots, s, a, sp, scene.cols, scene.rows)
}

function layoutDots(out, s, area, sp, cols, rows) {
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

  for (let j = 0; j < rows; j++) {
    const y = area.y + oy + j * sp.y
    const majorRow = isMajor(j, cj)
    for (let i = 0; i < cols; i++) {
      const x = area.x + ox + i * sp.x
      out.push({
        x, y,
        r: majorRow && isMajor(i, ci) ? majorR : r,
        fill: color ? color(x, y) : null,
      })
    }
  }
}

const CROP = { color: '#000000', width: 0.1 }

function cropMarks(trim, off, gap) {
  const lines = []
  for (const [cx, dx] of [[trim.x, -1], [trim.x + trim.w, 1]]) {
    for (const [cy, dy] of [[trim.y, -1], [trim.y + trim.h, 1]]) {
      lines.push({ ...CROP, x1: cx + dx * gap, y1: cy, x2: cx + dx * (off - 1), y2: cy })
      lines.push({ ...CROP, x1: cx, y1: cy + dy * gap, x2: cx, y2: cy + dy * (off - 1) })
    }
  }
  return lines
}

/**
 * Cut/fold marks on every page boundary that isn't the sheet edge.
 * Ticks run in from the sheet edge and stop short of the dots; lines cross the whole sheet.
 */
function sheetMarks(style, imp, page, m) {
  if (style !== 'ticks' && style !== 'lines') return []
  const inner = (v, max) => v > 0.01 && v < max - 0.01
  const xs = Array.from({ length: imp.cols + 1 }, (_, k) => imp.x0 + k * page.w).filter((x) => inner(x, imp.W))
  const ys = Array.from({ length: imp.rows + 1 }, (_, k) => imp.y0 + k * page.h).filter((y) => inner(y, imp.H))

  if (style === 'lines') {
    const dashed = { color: '#999999', width: 0.15, dash: true }
    return [
      ...xs.map((x) => ({ ...dashed, x1: x, y1: 0, x2: x, y2: imp.H })),
      ...ys.map((y) => ({ ...dashed, x1: 0, y1: y, x2: imp.W, y2: y })),
    ]
  }

  const reach = (margin) => (margin >= 4.5 ? margin - 1.5 : 3)
  const lenY = imp.y0 + reach(Math.min(m.top, m.bottom))
  const lenX = imp.x0 + reach(Math.min(m.left, m.right))
  return [
    ...xs.flatMap((x) => [
      { ...CROP, x1: x, y1: 0, x2: x, y2: lenY },
      { ...CROP, x1: x, y1: imp.H, x2: x, y2: imp.H - lenY },
    ]),
    ...ys.flatMap((y) => [
      { ...CROP, x1: 0, y1: y, x2: lenX, y2: y },
      { ...CROP, x1: imp.W, y1: y, x2: imp.W - lenX, y2: y },
    ]),
  ]
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
