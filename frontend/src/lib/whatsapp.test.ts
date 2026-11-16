import { describe, expect, it } from 'vitest'
import { linkWhatsApp, mensagemAcesso, mensagemAcessoEquipe } from './whatsapp'

const dados = { nome: 'Maria Souza', login: 'maria', senha: 'k7m2p9x4q8hn', url: 'https://raquelmachadoped.com.br/familia/entrar' }

describe('mensagemAcesso', () => {
  it('traz o 1º nome, o endereço, o usuário, a senha temporária e o aviso da troca', () => {
    const m = mensagemAcesso(dados)
    expect(m).toContain('Olá, Maria!')
    expect(m).toContain('Endereço: https://raquelmachadoped.com.br/familia/entrar')
    expect(m).toContain('Usuário: maria')
    expect(m).toContain('Senha temporária: k7m2p9x4q8hn')
    expect(m).toMatch(/primeiro acesso/i)
  })
  it('nome com espaços sobrando e uma palavra só', () => {
    expect(mensagemAcesso({ ...dados, nome: '  Joana  ' })).toContain('Olá, Joana!')
  })
})

describe('linkWhatsApp', () => {
  it('com contato: wa.me com o número e o texto codificado (quebras de linha e acentos)', () => {
    const link = linkWhatsApp('5584999990000', 'Olá!\nSenha: a b')
    expect(link).toBe('https://wa.me/5584999990000?text=Ol%C3%A1!%0ASenha%3A%20a%20b')
  })
  it('sem contato: não há link', () => {
    expect(linkWhatsApp(null, 'x')).toBeNull()
  })
})

describe('mensagemAcessoEquipe', () => {
  it('traz a área, o endereço, usuário e senha, sem falar em "família"', () => {
    const m = mensagemAcessoEquipe({ nome: 'Dra. Maria', login: 'dra.maria', senha: 'k7m2p9x4q8hn', url: 'https://x.com/painel/entrar', area: 'Área médica' })
    expect(m).toContain('Seu acesso à Área médica')
    expect(m).toContain('Endereço: https://x.com/painel/entrar')
    expect(m).toContain('Usuário: dra.maria')
    expect(m).toContain('Senha temporária: k7m2p9x4q8hn')
    expect(m).not.toMatch(/família/i)
  })
})
