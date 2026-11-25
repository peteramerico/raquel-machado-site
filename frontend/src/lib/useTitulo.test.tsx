import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTitulo } from './useTitulo'

describe('useTitulo', () => {
  it('define o título da aba e restaura o anterior ao sair', () => {
    document.title = 'Original'
    const { unmount } = renderHook(() => useTitulo('Palestras · Dra. Raquel Machado'))
    expect(document.title).toBe('Palestras · Dra. Raquel Machado')
    unmount()
    expect(document.title).toBe('Original')
  })
})
