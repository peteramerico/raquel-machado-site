import styles from '../styles/LinkButton.module.css'

type Variant = 'primary' | 'secondary' | 'address'

interface LinkButtonProps {
  href: string
  label: string
  icon: string
  variant?: Variant
}

export default function LinkButton({ href, label, icon, variant = 'secondary' }: LinkButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.btn} ${styles[variant]}`}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.text}>{label}</span>
    </a>
  )
}
