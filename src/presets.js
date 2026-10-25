import { sanitize } from './state.js'
import { downloadJSON } from './export.js'

const KEY = 'dpg.presets'
const FORMAT = 'dotted-paper-generator/presets'

export function listPresets() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function store(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {}
}

export const hasPreset = (name) => listPresets().some((p) => p.name === name)

export function savePreset(name, settings) {
  const list = listPresets().filter((p) => p.name !== name)
  list.push({ name, settings: { ...settings }, savedAt: new Date().toISOString() })
  list.sort((a, b) => a.name.localeCompare(b.name))
  store(list)
}

export function deletePreset(name) {
  store(listPresets().filter((p) => p.name !== name))
}

export function exportPresets() {
  downloadJSON({ format: FORMAT, version: 1, presets: listPresets() }, 'dotted-paper-presets.json')
}

/** Merges presets from a JSON file; same-named presets are replaced. Returns the count imported. */
export async function importPresets(file) {
  const data = JSON.parse(await file.text())
  // Accept the export format, a bare array, or a single settings object.
  const incoming = Array.isArray(data?.presets)
    ? data.presets
    : Array.isArray(data)
      ? data
      : [{ name: file.name.replace(/\.json$/i, ''), settings: data }]

  const valid = incoming.filter((p) => p && typeof p.name === 'string' && p.name.trim() && p.settings)
  if (!valid.length) throw new Error('No presets found')

  const byName = new Map(listPresets().map((p) => [p.name, p]))
  for (const p of valid) {
    byName.set(p.name.trim(), { name: p.name.trim(), settings: sanitize(p.settings), savedAt: p.savedAt ?? new Date().toISOString() })
  }
  store([...byName.values()].sort((a, b) => a.name.localeCompare(b.name)))
  return valid.length
}
