import './style.css'
import { h, svgIcon, ICONS, toast } from './dom.js'
import { t, fmt, getLang, setLang, LANGS } from './i18n.js'
import { loadState, saveState, sanitize } from './state.js'
import { buildScene, trimSize } from './scene.js'
import { renderSVG } from './render.js'
import { exportPDF, exportPNG, printScene } from './export.js'
import { renderPanel } from './panel.js'
import { PAPERS } from './papers.js'

const els = {
  header: document.getElementById('header'),
  panel: document.getElementById('panel'),
  toolbar: document.getElementById('toolbar'),
  preview: document.getElementById('preview'),
  info: document.getElementById('info'),
}

let state = loadState()
let scene = null
let frame = 0

const app = {
  get state() {
    return state
  },
  set(patch, { panel = false } = {}) {
    state = { ...state, ...patch }
    saveState(state)
    schedulePreview()
    if (panel) renderPanel(els.panel, app)
  },
  replace(settings) {
    state = sanitize(settings)
    saveState(state)
    renderAll()
  },
}

// --- Theme -----------------------------------------------------------------

const isDark = () => document.documentElement.classList.contains('dark')

function toggleTheme() {
  const dark = !isDark()
  document.documentElement.classList.toggle('dark', dark)
  try {
    localStorage.setItem('dpg.theme', dark ? 'dark' : 'light')
  } catch {}
  renderHeader()
}

// --- Header & toolbar -------------------------------------------------------

function renderHeader() {
  const lang = h('select', {
    id: 'lang', class: 'input w-auto py-1', 'aria-label': t('language'),
    onchange: (e) => {
      setLang(e.target.value)
      renderAll()
    },
  }, LANGS.map(([code, name]) => h('option', { value: code }, name)))
  lang.value = getLang()

  document.title = t('appTitle')
  els.header.replaceChildren(
    h('div', { class: 'flex items-center gap-3' },
      h('div', { class: 'grid size-9 place-items-center rounded-lg bg-indigo-600 text-white', 'aria-hidden': 'true', html: logo() }),
      h('div', {},
        h('h1', { class: 'text-base font-semibold leading-tight' }, t('appTitle')),
        h('p', { class: 'text-xs text-zinc-500 dark:text-zinc-400' }, t('tagline')),
      ),
    ),
    h('div', { class: 'ml-auto flex items-center gap-2' },
      lang,
      h('button', {
        id: 'theme', type: 'button', class: 'btn btn-ghost btn-icon',
        title: isDark() ? t('themeToLight') : t('themeToDark'),
        'aria-label': isDark() ? t('themeToLight') : t('themeToDark'),
        onclick: toggleTheme,
      }, svgIcon(isDark() ? ICONS.sun : ICONS.moon, 'size-5')),
    ),
  )
}

const logo = () =>
  '<svg class="size-5" viewBox="0 0 20 20" fill="currentColor">' +
  [4, 10, 16].flatMap((y) => [4, 10, 16].map((x) => `<circle cx="${x}" cy="${y}" r="1.6"/>`)).join('') +
  '</svg>'

async function runExport(button, fn) {
  if (!scene || scene.tooMany) return
  const original = button.innerHTML
  button.disabled = true
  button.textContent = t('exporting')
  try {
    await fn(scene, state)
  } catch (err) {
    console.error(err)
    toast(err?.message === 'Canvas too large' ? t('pngTooLarge') : t('exportError', { msg: err?.message ?? err }), 'error')
  } finally {
    button.disabled = false
    button.innerHTML = original
  }
}

function renderToolbar() {
  const dpi = h('select', {
    id: 'pngDpi', class: 'input w-auto py-1 text-xs', 'aria-label': 'DPI',
    onchange: (e) => app.set({ pngDpi: +e.target.value }),
  }, [150, 300, 600].map((d) => h('option', { value: String(d) }, `${d} DPI`)))
  dpi.value = String(state.pngDpi)

  const btn = (icon, label, fn, primary = false) => {
    const b = h('button', { type: 'button', class: `btn ${primary ? 'btn-primary' : 'btn-ghost'}` }, svgIcon(icon), label)
    b.addEventListener('click', () => runExport(b, fn))
    return b
  }

  els.toolbar.replaceChildren(
    btn(ICONS.printer, t('print'), async (sc) => {
      toast(t('printHint'))
      printScene(sc)
    }, true),
    btn(ICONS.download, t('pdf'), exportPDF),
    h('div', { class: 'flex items-center gap-2 rounded-lg border border-zinc-200 p-1 pl-1 dark:border-zinc-800' },
      btn(ICONS.download, t('png'), exportPNG),
      dpi,
      h('label', { class: 'flex items-center gap-1.5 pr-2 text-xs' },
        h('input', { type: 'checkbox', class: 'checkbox', checked: state.transparentBg, onchange: (e) => app.set({ transparentBg: e.target.checked }) }),
        t('transparentBg'),
      ),
    ),
    legend(),
  )
}

function legend() {
  const item = (cls, text) => h('span', { class: 'flex items-center gap-1.5' }, h('span', { class: `inline-block h-0 w-4 border-t-2 ${cls}` }), text)
  return h('div', { id: 'legend', class: 'ml-auto hidden items-center gap-3 text-xs text-zinc-500 sm:flex dark:text-zinc-400' },
    item('border-slate-500', t('legendTrim')),
    item('border-dashed border-red-500', t('legendBleed')),
    item('border-dashed border-cyan-500', t('legendMargin')),
  )
}

// --- Preview -----------------------------------------------------------------

function schedulePreview() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(renderPreview)
}

function renderPreview() {
  scene = buildScene(state)
  els.preview.innerHTML = renderSVG(scene, { guides: state.showGuides })
  const svg = els.preview.firstElementChild
  svg.classList.add('page')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', t('infoPage', { w: fmt(scene.width), h: fmt(scene.height) }))
  fitPreview()

  document.getElementById('legend')?.classList.toggle('invisible', !state.showGuides)

  const { w, h: hgt } = trimSize(state)
  const parts = [t('infoPage', { w: fmt(w), h: fmt(hgt) })]
  if (scene.imposition) parts.push(t('infoSheet', { n: scene.pages, sheet: PAPERS[state.sheet].name ?? state.sheet, w: fmt(scene.width), h: fmt(scene.height) }))
  else if (scene.width !== w) parts[0] += ` · ${fmt(scene.width)} × ${fmt(scene.height)} mm`
  if (scene.sheetTooSmall) parts.push(t('sheetTooSmall'))
  if (scene.empty) parts.push(t('noArea'))
  else if (scene.tooMany) parts.push(t('tooMany'))
  else if (scene.pattern === 'dots') {
    const vars = { cols: fmt(scene.cols, 0), rows: fmt(scene.rows, 0), count: fmt(scene.cols * scene.rows, 0) }
    parts.push(t(scene.imposition ? 'infoDotsPerPage' : 'infoDots', vars))
  } else {
    const text = scene.pattern === 'grid'
      ? t('infoGrid', { cols: fmt(Math.max(0, scene.cols - 1), 0), rows: fmt(Math.max(0, scene.rows - 1), 0) })
      : t('infoLines', { rows: fmt(scene.rows, 0) })
    parts.push(text + (scene.imposition ? t('perPage') : ''))
  }
  els.info.textContent = parts.join(' · ')
  els.info.classList.toggle('text-red-600', scene.empty || scene.tooMany || scene.sheetTooSmall)
}

/** Scales the page to fit the preview area while keeping its aspect ratio. */
function fitPreview() {
  const svg = els.preview.querySelector('svg')
  if (!svg || !scene) return
  const style = getComputedStyle(els.preview)
  const availW = els.preview.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  // On small screens the preview grows with the page; cap its height to the viewport.
  const availH = window.matchMedia('(min-width: 1024px)').matches
    ? els.preview.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    : window.innerHeight * 0.75
  const k = Math.min(availW / scene.width, availH / scene.height)
  svg.style.width = `${Math.max(0, scene.width * k)}px`
  svg.style.height = `${Math.max(0, scene.height * k)}px`
}

new ResizeObserver(fitPreview).observe(els.preview)

function renderAll() {
  renderHeader()
  renderToolbar()
  renderPanel(els.panel, app)
  renderPreview()
}

renderAll()
