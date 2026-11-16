import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VALOR_CONSULTA_PADRAO, formatarBRL, useValorConsulta } from './valorConsulta'

describe('valorConsulta', () => {
  it('o valor padrão é 400', () => {
    expect(VALOR_CONSULTA_PADRAO).toBe(400)
  })
  it('formata em reais no padrão brasileiro', () => {
    expect(formatarBRL(400)).toBe('R$ 400,00')
    expect(formatarBRL(1234.5)).toBe('R$ 1.234,50')
  })
  it('o hook devolve o valor padrão', () => {
    const { result } = renderHook(() => useValorConsulta())
    expect(result.current).toBe(400)
  })
})
