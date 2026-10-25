# Dotted Paper Generator

A small Vite + Tailwind CSS web app for making printable dot-grid paper.

- Paper sizes: ISO A3–A6, B4–B6, US Letter/Legal/Tabloid/Half Letter/Executive, Traveler's Notebook, or a custom size; portrait or landscape.
- Print on a larger sheet: e.g. two A5 pages on A4 (the sheet is turned automatically) with cut/fold ticks or dashed lines, and the binding gutter mirrored onto the fold side for booklets.
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

## Docker

```bash
docker compose up dev                     # dev server with hot reload on http://localhost:5173
docker compose --profile prod up web      # production build behind nginx on http://localhost:8080
```

## Deploying to Hostinger (dotted.rfcstudios.com.br)

The app is a static site, so no PHP or Node is needed on the server.

1. Build the upload package (no local Node needed):

   ```bash
   docker build --target release --output release .
   ```

   This writes `release/dist/` and `release/dotted-paper.zip`. The zip holds the files at its root.

2. In hPanel, go to **Domains → Subdomains** and create `dotted` under `rfcstudios.com.br`. Note the folder it creates (usually `public_html/dotted`).
3. Open **File Manager**, go into that folder, delete any placeholder `default.php`/`index.php`, upload `dotted-paper.zip`, and choose **Extract** right there. `index.html`, `.htaccess`, `robots.txt` and `assets/` should end up directly inside the subdomain folder.
4. Turn on SSL for the subdomain under **Security → SSL** if it isn't on already. `.htaccess` redirects HTTP to HTTPS.

To update later, rebuild, delete the old `assets/` folder, and extract the new zip over the rest.

`public/.htaccess` handles the HTTPS redirect, gzip, long-term caching for hashed assets, `no-cache` for `index.html`, and basic security headers.

## Structure

| File | Purpose |
| --- | --- |
| `src/scene.js` | Turns settings into a page description (dots, crop marks, boxes) in mm |
| `src/render.js` | Draws a scene as SVG (preview, print) or onto a canvas (PNG) |
| `src/export.js` | Print, PDF (jsPDF, vector) and PNG export |
| `src/panel.js` | Settings sidebar |
| `src/presets.js` | Preset storage and JSON import/export |
| `src/i18n.js` | Translations |
