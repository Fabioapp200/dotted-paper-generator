// Trim sizes in millimetres, portrait orientation.
export const PAPERS = {
  A3: { size: [297, 420] },
  A4: { size: [210, 297] },
  A5: { size: [148, 210] },
  A6: { size: [105, 148] },
  B4: { size: [250, 353] },
  B5: { size: [176, 250] },
  B6: { size: [125, 176] },
  Letter: { size: [215.9, 279.4], name: 'US Letter', inches: '8.5 × 11 in' },
  Legal: { size: [215.9, 355.6], name: 'US Legal', inches: '8.5 × 14 in' },
  Tabloid: { size: [279.4, 431.8], name: 'Tabloid', inches: '11 × 17 in' },
  HalfLetter: { size: [139.7, 215.9], name: 'Half Letter', inches: '5.5 × 8.5 in' },
  Executive: { size: [184.15, 266.7], name: 'Executive', inches: '7.25 × 10.5 in' },
  Traveler: { size: [110, 210], name: 'Traveler’s Notebook' },
}

export const PAPER_GROUPS = [
  ['paperGroup.iso', ['A3', 'A4', 'A5', 'A6', 'B4', 'B5', 'B6']],
  ['paperGroup.us', ['Letter', 'Legal', 'Tabloid', 'HalfLetter', 'Executive']],
  ['paperGroup.other', ['Traveler']],
]

export function paperLabel(id) {
  const p = PAPERS[id]
  const dims = p.inches ?? `${p.size[0]} × ${p.size[1]} mm`
  return `${p.name ?? id} (${dims})`
}
