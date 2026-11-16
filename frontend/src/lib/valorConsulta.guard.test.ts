import { describe, expect, it } from 'vitest'

const arquivos = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('guarda do valor da consulta', () => {
  it('nenhum arquivo de produção escreve o preço fixo', () => {
    const ofensores = Object.entries(arquivos)
      .filter(([caminho]) => !/valorConsulta|\.test\.|setupTests/.test(caminho))
      .filter(([, conteudo]) => /R\$\s*400|400,00/.test(conteudo))
      .map(([caminho]) => caminho)
    expect(ofensores).toEqual([])
  })
})
