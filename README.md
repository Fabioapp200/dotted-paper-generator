# Dotted Paper Generator

A small Vite + Tailwind CSS web app for making printable dot-grid paper.

- Paper sizes: ISO A3–A6, B4–B6, US Letter/Legal/Tabloid/Half Letter/Executive, Traveler's Notebook, or a custom size; portrait or landscape.
- Dot shapes: round, square, diamond, hexagon. Size, opacity, and optional emphasis of every Nth dot.
- Spacing linked in X and Y by default, or set independently. Grid centered in the printable area or anchored to the top-left margin.
- Printing helpers: per-side margins, binding gutter, bleed, dots extended into the bleed, crop marks, and on-screen trim/bleed/margin guides.
- Solid color (black by default), linear gradient with angle, or radial gradient. Paper color.
- Presets saved in the browser and exported to / imported from a local JSON file.
- Light and dark themes; English (US) and Portuguese (Brazil).
- Print at actual size, export a vector PDF, or a PNG at 150/300/600 DPI (with DPI metadata, optionally transparent).

All measurements are in millimetres.

## Development

Requires Node.js 20.19+ (or 22.12+).

```bash
npm install
npm run dev
```

`npm run build` writes a static site to `dist/`.

## Structure

| File | Purpose |
| --- | --- |
| `src/scene.js` | Turns settings into a page description (dots, crop marks, boxes) in mm |
| `src/render.js` | Draws a scene as SVG (preview, print) or onto a canvas (PNG) |
| `src/export.js` | Print, PDF (jsPDF, vector) and PNG export |
| `src/panel.js` | Settings sidebar |
| `src/presets.js` | Preset storage and JSON import/export |
| `src/i18n.js` | Translations |
