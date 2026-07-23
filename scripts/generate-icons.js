const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const pngToIco = require('png-to-ico').default

const svgPath = path.join(__dirname, '..', 'assets', 'icon.svg')
const svgBuffer = fs.readFileSync(svgPath)

const sizes = [16, 24, 32, 48, 64, 128, 256]

async function main() {
  const pngPaths = []

  for (const size of sizes) {
    const outPath = path.join(__dirname, '..', 'assets', `icon-${size}.png`)
    await sharp(svgBuffer, { density: 384 }).resize(size, size).png().toFile(outPath)
    pngPaths.push(outPath)
    console.log(`Generated ${outPath}`)
  }

  // Icône principale PNG (1024) pour usage général / fenêtre Electron en dev
  await sharp(svgBuffer, { density: 384 }).resize(512, 512).png().toFile(path.join(__dirname, '..', 'assets', 'icon.png'))
  console.log('Generated assets/icon.png (512x512)')

  // Combine PNG multi-résolution en .ico pour Windows
  const icoBuffer = await pngToIco(pngPaths)
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.ico'), icoBuffer)
  console.log('Generated assets/icon.ico')

  // Nettoyage des PNG intermédiaires (gardés uniquement: icon.png 512)
  for (const p of pngPaths) fs.unlinkSync(p)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
