import { describe, expect, it } from 'vitest'
import { primeiroNome } from './nome'

describe('primeiroNome', () => {
  it.each([
    ['Maria Souza', 'Maria'],
    ['  Joana  ', 'Joana'],
    ['Dra. Maria Teste', 'Maria'],
    ['Dr João Lima', 'João'],
    ['dra. raquel machado', 'raquel'],
    ['Doutora Ana', 'Ana'],
    ['Prof. Carlos', 'Carlos'],
  ])('%p → %p', (entrada, esperado) => {
    expect(primeiroNome(entrada)).toBe(esperado)
  })

  it('só o título (sem nome) devolve o texto original, nunca vazio', () => {
    expect(primeiroNome('Dra.')).toBe('Dra.')
    expect(primeiroNome('Drake')).toBe('Drake') // "Dra" colado ao nome não é título
  })
})
