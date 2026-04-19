import type { ReactNode } from 'react'
import styles from '../styles/LinkButton.module.css'

type Variant = 'primary' | 'secondary' | 'address'

interface LinkButtonProps {
  href: string
  label: string
  sublabel?: string
  icon: ReactNode
  variant?: Variant
  external?: boolean
}

export default function LinkButton({
  href,
  label,
  sublabel,
  icon,
  variant = 'secondary',
  external = true,
}: LinkButtonProps) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={`${styles.btn} ${styles[variant]}`}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.textWrap}>
        <span className={styles.label}>{label}</span>
        {sublabel && <span className={styles.sublabel}>{sublabel}</span>}
      </span>
      <span className={styles.chevron} aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </span>
    </a>
  )
}
