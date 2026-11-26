import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const LIMITE_KB = 350
const pastas = ['public/images', 'public']
const arquivos = pastas.flatMap((pasta) =>
  readdirSync(join(process.cwd(), pasta))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => join(pasta, f)),
)

describe('orçamento de imagens', () => {
  it.each(arquivos)('%s cabe em 350 KB', (arquivo) => {
    const kb = statSync(join(process.cwd(), arquivo)).size / 1024
    expect(kb).toBeLessThanOrEqual(LIMITE_KB)
  })
})
