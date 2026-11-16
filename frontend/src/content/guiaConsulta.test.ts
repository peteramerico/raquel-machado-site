import { describe, expect, it } from 'vitest'
import { guia } from './guiaConsulta'

describe('guiaConsulta', () => {
  it('tem os 7 capítulos na ordem do guia', () => {
    expect(guia.capitulos.map((c) => c.id)).toEqual([
      'puericultura', 'retorno', 'calendario', 'prenatal', 'trazer', 'whatsapp', 'valor',
    ])
  })
  it('o calendário tem 6 faixas, da primeira consulta à anual', () => {
    expect(guia.calendario.faixas).toHaveLength(6)
    expect(guia.calendario.faixas[0].idade).toBe('Primeira consulta do recém-nascido')
    expect(guia.calendario.faixas[5].frequencia).toBe('Anual')
  })
  it('o checklist tem 5 itens', () => {
    expect(guia.trazer.itens).toHaveLength(5)
  })
  it('não guarda o preço (vem de useValorConsulta)', () => {
    expect(JSON.stringify(guia)).not.toMatch(/R\$|400/)
  })
})
