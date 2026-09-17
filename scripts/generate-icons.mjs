// Regenerates the installer/app icons from public/favicon.svg.
//
//   npm run icons
//
// Produces:
//   build/icon.ico  — Windows installer + window icon (16–256 px frames)
//   build/icon.png  — 512 px, used by the Linux AppImage and as a generic asset
//
// The icon tooling is intentionally NOT a dependency of the project: it is only
// needed when the artwork changes. Install it on demand:
//   npm i -D --no-save @resvg/resvg-js png-to-ico
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)

let Resvg, pngToIco
try {
  ;({ Resvg } = require('@resvg/resvg-js'))
  const mod = require('png-to-ico')
  // png-to-ico ships as an ESM/CJS interop object: the function is `.default`.
  pngToIco = typeof mod === 'function' ? mod : mod.default
} catch {
  console.error(
    'Icon tooling missing. Install it on demand:\n' +
      '  npm i -D --no-save @resvg/resvg-js png-to-ico\n' +
      'then re-run `npm run icons`.',
  )
  process.exit(1)
}

const ROOT = path.join(import.meta.dirname, '..')
const SVG = path.join(ROOT, 'public', 'favicon.svg')
const OUT = path.join(ROOT, 'build')
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

if (!fs.existsSync(SVG)) {
  console.error(`Source artwork not found: ${SVG}`)
  process.exit(1)
}

const svg = fs.readFileSync(SVG)
const render = (width) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()

fs.mkdirSync(OUT, { recursive: true })

// 512 px PNG (Linux AppImage icon).
const png512 = render(512)
fs.writeFileSync(path.join(OUT, 'icon.png'), png512)

// Multi-resolution .ico. png-to-ico takes file paths, so stage the frames.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ta-icons-'))
try {
  const frames = ICO_SIZES.map((size) => {
    const file = path.join(tmp, `icon-${size}.png`)
    fs.writeFileSync(file, render(size))
    return file
  })
  const ico = await pngToIco(frames)
  fs.writeFileSync(path.join(OUT, 'icon.ico'), ico)

  const kb = (n) => `${(n / 1024).toFixed(1)} kB`
  console.log(`build/icon.png  512x512            ${kb(png512.length)}`)
  console.log(`build/icon.ico  ${ICO_SIZES.join('/')}  ${kb(ico.length)}`)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
