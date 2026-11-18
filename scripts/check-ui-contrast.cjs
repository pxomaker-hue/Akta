// Guard the six built-in Akta accent palettes against unreadable white CTA text.
// The CSS recipe uses 60% accent + 40% #0b1220 for text-bearing gradient controls.
const fs = require('node:fs')
const path = require('node:path')

const presets = fs.readFileSync(path.resolve(__dirname, '../src/shared/accentPresets.ts'), 'utf8')
const matches = [...presets.matchAll(/primary:\s*'(#[0-9a-f]{6})',\s*secondary:\s*'(#[0-9a-f]{6})'/gi)]
if (matches.length !== 6) throw new Error(`Expected six Akta accent palettes, found ${matches.length}`)

const rgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
const canvas = rgb('#0b1220')
const toLinear = (value) => {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
function contrastWithWhite(hex) {
  const blended = rgb(hex).map((value, i) => value * 0.6 + canvas[i] * 0.4)
  const [r, g, b] = blended.map(toLinear)
  const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722
  return 1.05 / (luminance + 0.05)
}
for (const [index, match] of matches.entries()) {
  for (const hex of [match[1], match[2]]) {
    const ratio = contrastWithWhite(hex)
    if (ratio < 4.5) throw new Error(`Accent ${index + 1} ${hex}: ${ratio.toFixed(2)}:1 < WCAG AA`)
  }
}
console.log('OK: all six Akta accent gradients have >= 4.5:1 white-text contrast.')
