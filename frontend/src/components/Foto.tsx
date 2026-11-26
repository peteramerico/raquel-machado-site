type Props = {
  nome: string
  larguras: readonly number[]
  reserva: number
  largura: number
  altura: number
  alt: string
  sizes: string
  prioridade?: boolean
  className?: string
}

// Foto responsiva: WebP em várias larguras (srcset) e JPG de reserva. As imagens são geradas por tools/imagens.
export function Foto({ nome, larguras, reserva, largura, altura, alt, sizes, prioridade = false, className }: Props) {
  const srcSet = larguras.map((w) => `/images/${nome}-${w}.webp ${w}w`).join(', ')
  return (
    <picture style={{ display: 'contents' }}>
      <source type="image/webp" srcSet={srcSet} sizes={sizes} />
      <img
        src={`/images/${nome}-${reserva}.jpg`}
        width={largura}
        height={altura}
        alt={alt}
        className={className}
        decoding="async"
        {...(prioridade ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })}
      />
    </picture>
  )
}
