import { renderSVG, renderCanvas } from './render.js'
import { polygon, spacing, impose, patternOf } from './scene.js'

const FILE_PREFIX = { dots: 'dotted', lines: 'lined', grid: 'grid' }

export function fileBase(s) {
  const pattern = patternOf(s)
  const sp = spacing(s)
  const gap = pattern === 'lines' || sp.x === sp.y ? `${sp.y}mm` : `${sp.x}x${sp.y}mm`
  const paper = s.paper === 'custom' ? `${s.customWidth}x${s.customHeight}mm` : s.paper
  const sheet = impose(s)?.count ? `-on-${s.sheet}` : ''
  const shape = pattern === 'dots' ? `-${s.shape}` : ''
  return `${FILE_PREFIX[pattern]}-${paper}${sheet}${shape}-${gap}`
}

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadJSON(data, name) {
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), name)
}

// --- Print ---------------------------------------------------------------

export function printScene(scene) {
  const W = +scene.width.toFixed(3)
  const H = +scene.height.toFixed(3)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.append(iframe)

  const doc = iframe.contentDocument
  doc.open()
  doc.write(`<!doctype html><html><head><title>Dotted paper</title><style>
    @page { size: ${W}mm ${H}mm; margin: 0 }
    html, body { margin: 0; padding: 0 }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact }
    svg { display: block; width: ${W}mm; height: ${H}mm }
  </style></head><body>${renderSVG(scene)}</body></html>`)
  doc.close()

  const win = iframe.contentWindow
  const cleanup = () => setTimeout(() => iframe.remove(), 500)
  win.addEventListener('afterprint', cleanup, { once: true })
  setTimeout(() => {
    win.focus()
    win.print()
    // Some browsers return from print() before afterprint fires; this is a safety net.
    setTimeout(cleanup, 60_000)
  }, 100)
}

// --- PNG -----------------------------------------------------------------

export async function exportPNG(scene, s) {
  const dpi = s.pngDpi
  const canvas = renderCanvas(scene, dpi, { transparent: s.transparentBg })
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas too large'))), 'image/png'),
  )
  const bytes = withDpi(new Uint8Array(await blob.arrayBuffer()), dpi)
  download(new Blob([bytes], { type: 'image/png' }), `${fileBase(s)}-${dpi}dpi.png`)
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes) {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Inserts a pHYs chunk so the PNG prints at its true physical size. */
function withDpi(png, dpi) {
  const ppm = Math.round(dpi / 0.0254)
  const chunk = new Uint8Array(21)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, 9)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
  view.setUint32(8, ppm)
  view.setUint32(12, ppm)
  chunk[16] = 1 // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)))

  const ihdrEnd = 8 + 25 // signature + IHDR chunk
  const out = new Uint8Array(png.length + chunk.length)
  out.set(png.subarray(0, ihdrEnd), 0)
  out.set(chunk, ihdrEnd)
  out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length)
  return out
}

// --- PDF -----------------------------------------------------------------

export async function exportPDF(scene, s) {
  const { jsPDF } = await import('jspdf')
  const W = scene.width
  const H = scene.height
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: W > H ? 'landscape' : 'portrait', compress: true })

  doc.setFillColor(scene.background)
  doc.rect(0, 0, W, H, 'F')

  if (scene.opacity < 1) doc.setGState(new doc.GState({ opacity: scene.opacity }))
  let current = null
  const fill = (c) => {
    if (c !== current) doc.setFillColor((current = c))
  }
  for (const d of scene.dots) {
    fill(d.fill ?? scene.solid)
    const pts = polygon(scene.shape, d.x, d.y, d.r)
    if (!pts) {
      doc.circle(d.x, d.y, d.r, 'F')
    } else {
      // jsPDF.lines takes segments relative to the previous point.
      const rel = pts.slice(1).map(([x, y], i) => [x - pts[i][0], y - pts[i][1]])
      doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'F', true)
    }
  }

  drawLines(doc, scene.strokes, scene.solid ?? '#000000')

  if (scene.lines.length) {
    doc.setGState(new doc.GState({ opacity: 1 }))
    drawLines(doc, scene.lines, '#000000')
  }

  doc.save(`${fileBase(s)}.pdf`)
}

/** Draws lines, only changing pen settings when they differ from the previous line. */
function drawLines(doc, lines, fallback) {
  let color, width, dash
  for (const l of lines) {
    if ((l.color ?? fallback) !== color) doc.setDrawColor((color = l.color ?? fallback))
    if (l.width !== width) doc.setLineWidth((width = l.width))
    if (l.dash !== dash) doc.setLineDashPattern((dash = l.dash) ?? [], 0)
    doc.line(l.x1, l.y1, l.x2, l.y2)
  }
}
