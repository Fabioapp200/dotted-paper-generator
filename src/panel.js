import { h, svgIcon, ICONS, toast } from './dom.js'
import { t } from './i18n.js'
import { PAPERS, PAPER_GROUPS, paperLabel } from './papers.js'
import { polygon } from './scene.js'
import { DEFAULTS } from './state.js'
import * as presets from './presets.js'

const SHAPES = ['round', 'square', 'diamond', 'hex']
const closedSections = new Set(['presets'])

/**
 * Renders the settings sidebar. `app` exposes:
 *   state, set(patch, { panel }), replace(settings)
 * Number/range/color inputs update only the preview while typing; toggles and
 * selects also re-render the panel so dependent fields appear or disappear.
 */
export function renderPanel(root, app) {
  const s = app.state
  const focusedId = document.activeElement?.id
  const scroll = root.scrollTop

  // --- Control helpers -----------------------------------------------------

  const label = (text, forId) => h('label', { class: 'field-label', for: forId }, text)
  const hint = (text) => h('p', { class: 'hint' }, text)
  const field = (key, text, control, help) => h('div', { class: 'space-y-1' }, label(text, `f-${key}`), control, help && hint(help))

  const number = (key, { min = 0, max, step = 0.1, unit = 'mm', write = (v) => ({ [key]: v }) } = {}) =>
    h('div', { class: 'relative' },
      h('input', {
        id: `f-${key}`, type: 'number', inputmode: 'decimal', class: 'input pr-11',
        value: String(s[key]), min, max, step,
        oninput: (e) => {
          const v = parseFloat(e.target.value)
          if (!Number.isFinite(v)) return
          const clamped = Math.min(max ?? Infinity, Math.max(min, v))
          app.set(write(clamped))
        },
        onblur: (e) => (e.target.value = String(app.state[key])),
      }),
      unit && h('span', { class: 'unit' }, unit),
    )

  const range = (key, { min, max, step, unit = '', display = (v) => v }) => {
    const out = h('output', { class: 'w-14 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-300' }, `${display(s[key])}${unit}`)
    return h('div', { class: 'flex items-center gap-3' },
      h('input', {
        id: `f-${key}`, type: 'range', class: 'range flex-1', min, max, step, value: String(s[key]),
        oninput: (e) => {
          const v = parseFloat(e.target.value)
          out.textContent = `${display(v)}${unit}`
          app.set({ [key]: v })
        },
      }),
      out,
    )
  }

  const select = (key, options, onPick = (v) => ({ [key]: v })) => {
    const el = h('select', { id: `f-${key}`, class: 'input', onchange: (e) => app.set(onPick(e.target.value), { panel: true }) }, options)
    el.value = s[key]
    return el
  }
  const opt = (value, text) => h('option', { value }, text)

  const checkbox = (key, text, onToggle = (v) => ({ [key]: v })) =>
    h('label', { class: 'flex cursor-pointer items-start gap-2.5 text-sm' },
      h('input', {
        id: `f-${key}`, type: 'checkbox', class: 'checkbox mt-0.5', checked: s[key],
        onchange: (e) => app.set(onToggle(e.target.checked), { panel: true }),
      }),
      h('span', {}, text),
    )

  const color = (key, text) =>
    h('label', { class: 'flex items-center gap-3 text-sm', for: `f-${key}` },
      h('input', { id: `f-${key}`, type: 'color', class: 'color', value: s[key], oninput: (e) => app.set({ [key]: e.target.value }) }),
      h('span', { class: 'flex-1' }, text),
      h('code', { class: 'text-xs uppercase text-zinc-500 dark:text-zinc-400' }, s[key]),
    )

  const segmented = (key, items) =>
    h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t(key) },
      items.map(([value, text]) =>
        h('button', {
          type: 'button', role: 'radio', id: `f-${key}-${value}`, 'aria-checked': String(s[key] === value),
          onclick: () => app.set({ [key]: value }, { panel: true }),
        }, text),
      ),
    )

  const linkToggle = (key, text, onToggle) =>
    h('button', {
      type: 'button', id: `f-${key}`, class: 'link-toggle', 'aria-pressed': String(s[key]), title: text,
      onclick: () => app.set(onToggle(!s[key]), { panel: true }),
    }, svgIcon(s[key] ? ICONS.link : ICONS.unlink), h('span', {}, text))

  const section = (id, title, ...body) => {
    const el = h('details', { class: 'section', open: !closedSections.has(id) },
      h('summary', {}, h('span', {}, title), svgIcon(ICONS.chevron, 'size-4 chevron')),
      h('div', { class: 'space-y-4 px-4 pb-5 pt-1' }, body),
    )
    el.addEventListener('toggle', () => (el.open ? closedSections.delete(id) : closedSections.add(id)))
    return el
  }

  // --- Sections ------------------------------------------------------------

  const paper = section('paper', t('sec.paper'),
    field('paper', t('paperSize'),
      select('paper', [
        ...PAPER_GROUPS.map(([group, ids]) => h('optgroup', { label: t(group) }, ids.map((id) => opt(id, paperLabel(id))))),
        opt('custom', t('customSize')),
      ], (v) => {
        // Seed the custom size from the current paper so switching is not jarring.
        if (v !== 'custom' || s.paper === 'custom') return { paper: v }
        const [w, hgt] = PAPERS[s.paper].size
        return s.orientation === 'landscape' ? { paper: v, customWidth: hgt, customHeight: w } : { paper: v, customWidth: w, customHeight: hgt }
      }),
    ),
    s.paper === 'custom'
      ? h('div', { class: 'grid grid-cols-2 gap-3' },
          field('customWidth', t('width'), number('customWidth', { min: 10, max: 2000, step: 1 })),
          field('customHeight', t('height'), number('customHeight', { min: 10, max: 2000, step: 1 })),
        )
      : h('div', { class: 'space-y-1' },
          h('span', { class: 'field-label' }, t('orientation')),
          segmented('orientation', [['portrait', t('portrait')], ['landscape', t('landscape')]]),
        ),
    color('background', t('background')),
  )

  const dots = section('dots', t('sec.dots'),
    h('div', { class: 'space-y-1' },
      h('span', { class: 'field-label' }, t('shape')),
      h('div', { class: 'grid grid-cols-4 gap-2', role: 'radiogroup', 'aria-label': t('shape') },
        SHAPES.map((shape) =>
          h('button', {
            type: 'button', role: 'radio', id: `f-shape-${shape}`, class: 'shape-btn', 'aria-checked': String(s.shape === shape),
            onclick: () => app.set({ shape }, { panel: true }),
          }, h('span', { 'aria-hidden': 'true', html: shapeIcon(shape) }), h('span', { class: 'text-xs' }, t(`shape.${shape}`))),
        ),
      ),
    ),
    field('dotSize', t('dotSize'), number('dotSize', { min: 0.05, max: 50, step: 0.05 })),
    field('opacity', t('opacity'), range('opacity', { min: 0.05, max: 1, step: 0.05, unit: '%', display: (v) => Math.round(v * 100) })),
    h('div', { class: 'grid grid-cols-2 gap-3' },
      field('majorEvery', t('majorEvery'), number('majorEvery', { min: 0, max: 100, step: 1, unit: '' })),
      field('majorScale', t('majorScale'), number('majorScale', { min: 0.1, max: 10, step: 0.1, unit: '×' })),
    ),
    hint(t('majorEveryHint')),
  )

  const sp = section('spacing', t('sec.spacing'),
    // Linked mode reads spacingX for both axes; copying X into Y on every toggle keeps them consistent.
    linkToggle('linkSpacing', t('linkSpacing'), (v) => ({ linkSpacing: v, spacingY: s.spacingX })),
    s.linkSpacing
      ? field('spacingX', t('spacing'), number('spacingX', { min: 0.5, max: 100, step: 0.5, write: (v) => ({ spacingX: v, spacingY: v }) }))
      : h('div', { class: 'grid grid-cols-2 gap-3' },
          field('spacingX', t('spacingX'), number('spacingX', { min: 0.5, max: 100, step: 0.5 })),
          field('spacingY', t('spacingY'), number('spacingY', { min: 0.5, max: 100, step: 0.5 })),
        ),
    field('align', t('align'), select('align', [opt('center', t('align.center')), opt('start', t('align.start'))])),
  )

  const sides = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft']
  const print = section('print', t('sec.print'),
    linkToggle('linkMargins', t('linkMargins'), (v) => ({ linkMargins: v, ...Object.fromEntries(sides.map((k) => [k, s.marginTop])) })),
    s.linkMargins
      ? field('marginTop', t('margin'), number('marginTop', { max: 500, step: 1, write: (v) => Object.fromEntries(sides.map((k) => [k, v])) }))
      : h('div', { class: 'grid grid-cols-2 gap-3' }, sides.map((k) => field(k, t(k), number(k, { max: 500, step: 1 })))),
    field('gutter', t('gutter'), number('gutter', { max: 200, step: 1 }), t('gutterHint')),
    field('bleed', t('bleed'), number('bleed', { max: 20, step: 0.5 }), t('bleedHint')),
    h('div', { class: 'space-y-2.5' },
      checkbox('fillBleed', t('fillBleed')),
      checkbox('cropMarks', t('cropMarks')),
      checkbox('showGuides', t('showGuides')),
    ),
  )

  const gradient = s.colorMode !== 'solid'
  const colors = section('color', t('sec.color'),
    field('colorMode', t('colorMode'), select('colorMode', ['solid', 'linear', 'radial'].map((m) => opt(m, t(`mode.${m}`))))),
    color('color', gradient ? t('colorStart') : t('color')),
    gradient && color('colorEnd', t('colorEnd')),
    gradient && h('button', {
      type: 'button', class: 'btn btn-ghost btn-sm', id: 'f-swap',
      onclick: () => app.set({ color: s.colorEnd, colorEnd: s.color }, { panel: true }),
    }, svgIcon(ICONS.swap), t('swapColors')),
    s.colorMode === 'linear' && field('gradientAngle', t('angle'), range('gradientAngle', { min: 0, max: 360, step: 5, unit: '°' })),
    s.colorMode === 'radial' && hint(t('radialHint')),
    gradient && h('div', { class: 'h-3 rounded-full ring-1 ring-black/10 dark:ring-white/10', style: `background:linear-gradient(90deg, ${s.color}, ${s.colorEnd})` }),
  )

  root.replaceChildren(paper, dots, sp, print, colors, presetsSection(app, section, label))

  if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true })
  root.scrollTop = scroll
}

function presetsSection(app, section, label) {
  const list = presets.listPresets()
  const nameInput = h('input', { id: 'f-presetName', class: 'input', maxlength: '60', placeholder: t('presetPlaceholder') })
  const fileInput = h('input', {
    type: 'file', accept: 'application/json,.json', class: 'hidden',
    onchange: async (e) => {
      const file = e.target.files[0]
      e.target.value = ''
      if (!file) return
      try {
        toast(t('importOk', { n: await presets.importPresets(file) }))
        app.set({}, { panel: true })
      } catch {
        toast(t('importError'), 'error')
      }
    },
  })

  const save = (e) => {
    e.preventDefault()
    const name = nameInput.value.trim()
    if (!name) return nameInput.focus()
    if (presets.hasPreset(name) && !confirm(t('confirmOverwrite', { name }))) return
    presets.savePreset(name, app.state)
    toast(t('presetSaved', { name }))
    app.set({}, { panel: true })
  }

  return section('presets', t('sec.presets'),
    h('form', { class: 'space-y-1', onsubmit: save },
      label(t('presetName'), 'f-presetName'),
      h('div', { class: 'flex gap-2' }, nameInput, h('button', { type: 'submit', class: 'btn btn-primary' }, t('savePreset'))),
    ),
    list.length
      ? h('ul', { class: 'divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800' },
          list.map((p) =>
            h('li', { class: 'flex items-center gap-2 px-3 py-2 text-sm' },
              h('span', { class: 'min-w-0 flex-1 truncate', title: p.name }, p.name),
              h('button', {
                type: 'button', class: 'btn btn-ghost btn-sm',
                onclick: () => {
                  app.replace(p.settings)
                  toast(t('presetLoaded', { name: p.name }))
                },
              }, t('load')),
              h('button', {
                type: 'button', class: 'btn btn-ghost btn-sm btn-icon text-red-600 dark:text-red-400', title: t('delete'), 'aria-label': `${t('delete')} ${p.name}`,
                onclick: () => {
                  if (!confirm(t('confirmDelete', { name: p.name }))) return
                  presets.deletePreset(p.name)
                  app.set({}, { panel: true })
                },
              }, svgIcon(ICONS.trash)),
            ),
          ),
        )
      : h('p', { class: 'hint' }, t('noPresets')),
    h('div', { class: 'flex flex-wrap gap-2' },
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', disabled: !list.length, onclick: presets.exportPresets }, svgIcon(ICONS.download), t('exportJson')),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => fileInput.click() }, svgIcon(ICONS.upload), t('importJson')),
      fileInput,
      h('button', {
        type: 'button', class: 'btn btn-ghost btn-sm ml-auto',
        onclick: () => confirm(t('confirmReset')) && app.replace(DEFAULTS),
      }, svgIcon(ICONS.reset), t('reset')),
    ),
  )
}

function shapeIcon(shape) {
  const pts = polygon(shape, 12, 12, 6)
  const body = pts ? `<polygon points="${pts.map((p) => p.map((n) => n.toFixed(2)).join(',')).join(' ')}"/>` : '<circle cx="12" cy="12" r="6"/>'
  return `<svg class="size-6" viewBox="0 0 24 24" fill="currentColor">${body}</svg>`
}
