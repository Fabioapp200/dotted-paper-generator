import { polygon } from './scene.js'

const f = (n) => +n.toFixed(3)

/** Dash pattern (mm) for dashed cut/fold lines, shared by every renderer. */
export const DASH = [1.5, 1.5]

function svgDot(shape, d) {
  const fill = d.fill ? ` fill="${d.fill}"` : ''
  const pts = polygon(shape, d.x, d.y, d.r)
  if (!pts) return `<circle cx="${f(d.x)}" cy="${f(d.y)}" r="${f(d.r)}"${fill}/>`
  return `<polygon points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}"${fill}/>`
}

const rect = (b, attrs) => `<rect x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" ${attrs}/>`

/**
 * Renders a scene as an SVG string sized in millimetres.
 * `guides` adds preview-only overlays (bleed, trim and margin boxes).
 */
export function renderSVG(scene, { guides = false, transparent = false } = {}) {
  const { width: W, height: H } = scene
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}mm" height="${f(H)}mm">`,
  ]
  if (!transparent) out.push(`<rect width="${f(W)}" height="${f(H)}" fill="${scene.background}"/>`)

  out.push(`<g fill="${scene.solid ?? '#000'}"${scene.opacity < 1 ? ` fill-opacity="${scene.opacity}"` : ''}>`)
  for (const d of scene.dots) out.push(svgDot(scene.shape, d))
  out.push('</g>')

  for (const l of scene.lines) {
    const dash = l.dash ? ` stroke-dasharray="${DASH.join(' ')}"` : ''
    out.push(`<line x1="${f(l.x1)}" y1="${f(l.y1)}" x2="${f(l.x2)}" y2="${f(l.y2)}" stroke="${l.color}" stroke-width="${l.width}"${dash}/>`)
  }

  if (guides) {
    const g = 'fill="none" vector-effect="non-scaling-stroke" stroke-width="1"'
    const { bleed, trims, margins } = scene.guides
    if (bleed) out.push(rect(bleed, `${g} stroke="#ef4444" stroke-dasharray="2 3"`))
    for (const b of trims) out.push(rect(b, `${g} stroke="#64748b"`))
    for (const b of margins) if (b.w > 0 && b.h > 0) out.push(rect(b, `${g} stroke="#06b6d4" stroke-dasharray="4 3"`))
  }

  out.push('</svg>')
  return out.join('')
}

function traceDot(ctx, shape, d) {
  const pts = polygon(shape, d.x, d.y, d.r)
  if (!pts) {
    ctx.moveTo(d.x + d.r, d.y)
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
    return
  }
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

/** Rasterizes a scene at the given DPI. */
export function renderCanvas(scene, dpi, { transparent = false } = {}) {
  const k = dpi / 25.4
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(scene.width * k)
  canvas.height = Math.round(scene.height * k)
  const ctx = canvas.getContext('2d')
  ctx.scale(k, k)

  if (!transparent) {
    ctx.fillStyle = scene.background
    ctx.fillRect(0, 0, scene.width, scene.height)
  }

  ctx.globalAlpha = scene.opacity
  if (scene.solid) {
    // One path for every dot is far faster than filling each separately.
    ctx.fillStyle = scene.solid
    ctx.beginPath()
    for (const d of scene.dots) traceDot(ctx, scene.shape, d)
    ctx.fill()
  } else {
    for (const d of scene.dots) {
      ctx.fillStyle = d.fill
      ctx.beginPath()
      traceDot(ctx, scene.shape, d)
      ctx.fill()
    }
  }

  ctx.globalAlpha = 1
  for (const l of scene.lines) {
    ctx.strokeStyle = l.color
    ctx.lineWidth = Math.max(l.width, 1 / k)
    ctx.setLineDash(l.dash ? DASH : [])
    ctx.beginPath()
    ctx.moveTo(l.x1, l.y1)
    ctx.lineTo(l.x2, l.y2)
    ctx.stroke()
  }
  return canvas
}
