export const DEFAULTS = Object.freeze({
  // Paper
  paper: 'A4',
  orientation: 'portrait',
  customWidth: 210,
  customHeight: 297,
  // Print several pages on a larger sheet ('none' or a PAPERS id).
  sheet: 'none',
  sheetMarks: 'ticks',
  mirrorGutter: true,
  // Dots
  shape: 'round',
  dotSize: 0.6,
  opacity: 1,
  majorEvery: 0,
  majorScale: 1.8,
  // Spacing
  linkSpacing: true,
  spacingX: 5,
  spacingY: 5,
  align: 'center',
  // Margins & printing
  linkMargins: true,
  marginTop: 10,
  marginRight: 10,
  marginBottom: 10,
  marginLeft: 10,
  gutter: 0,
  bleed: 0,
  fillBleed: false,
  cropMarks: false,
  showGuides: true,
  // Color
  colorMode: 'solid',
  color: '#000000',
  colorEnd: '#4f46e5',
  gradientAngle: 90,
  background: '#ffffff',
  transparentBg: false,
  // Export
  pngDpi: 300,
})

const KEY = 'dpg.settings'

/** Keeps only known keys whose type matches the defaults. */
export function sanitize(obj) {
  const out = { ...DEFAULTS }
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(DEFAULTS)) {
      if (typeof obj[k] === typeof DEFAULTS[k]) out[k] = obj[k]
    }
  }
  return out
}

export function loadState() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY)))
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
}
