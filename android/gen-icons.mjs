import sharp from 'sharp'
import { mkdirSync } from 'fs'

// CineVerse icon: dark cinema bg + film strip + red play
const svg = (bg = '#08090D') => `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="108" fill="${bg}"/>
  <rect x="18" y="18" width="476" height="476" rx="94" fill="#10121A"/>
  <rect x="106" y="128" width="300" height="256" rx="28" fill="#191C24" stroke="#2A2F3D" stroke-width="8"/>
  <!-- sprocket holes top -->
  ${[150, 206, 262, 318].map(x => `<rect x="${x}" y="150" width="26" height="20" rx="6" fill="#222632"/>`).join('')}
  <!-- sprocket holes bottom -->
  ${[150, 206, 262, 318].map(x => `<rect x="${x}" y="342" width="26" height="20" rx="6" fill="#222632"/>`).join('')}
  <!-- play badge -->
  <circle cx="256" cy="256" r="78" fill="#E50914"/>
  <path d="M236 216 L316 256 L236 296 Z" fill="#FFFFFF"/>
</svg>`

const out = '/home/z/apk-build/icons'
mkdirSync(out, { recursive: true })

const targets = [
  ['ic_launcher-mdpi.png', 48],
  ['ic_launcher-hdpi.png', 72],
  ['ic_launcher-xhdpi.png', 96],
  ['ic_launcher-xxhdpi.png', 144],
  ['ic_launcher-xxxhdpi.png', 192],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]

for (const [name, size] of targets) {
  await sharp(Buffer.from(svg())).resize(size, size).png().toFile(`${out}/${name}`)
  console.log('ok', name, size)
}
console.log('DONE')
