// Uso: node otimizar.mjs <pasta-dos-originais> <pasta-de-saida>
// Gera <nome>-<largura>.webp e <nome>-<maior>.jpg (reserva). Rodar só localmente.
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const [origem, destino] = process.argv.slice(2)
if (!origem || !destino) throw new Error('Uso: node otimizar.mjs <originais> <saida>')

// Larguras = até ~2x a largura em CSS medida em produção (hero 400, sobre 460, cartões 582, avatar 91).
const FOTOS = [
  { nome: 'hero', arquivo: 'hero.jpg', larguras: [480, 800, 1200] },
  { nome: 'sobre', arquivo: 'sobre.jpg', larguras: [480, 920, 1200] },
  { nome: 'pediatria', arquivo: 'pediatria.jpg', larguras: [640, 1164] },
  { nome: 'neonatologia', arquivo: 'neonatologia.jpg', larguras: [640, 1164] },
  { nome: 'raquel-avatar', arquivo: 'raquel-avatar.jpg', larguras: [192], webp: false }, // Links usa só o JPG (img com onError)
]

await mkdir(destino, { recursive: true })
for (const f of FOTOS) {
  const base = sharp(join(origem, f.arquivo), { failOn: 'none' }).rotate() // respeita a rotação EXIF
  for (const w of f.webp === false ? [] : f.larguras) {
    await base.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(destino, `${f.nome}-${w}.webp`))
  }
  const maior = Math.max(...f.larguras)
  await base.clone().resize({ width: maior, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(join(destino, `${f.nome}-${maior}.jpg`))
  console.log('ok', f.nome)
}
