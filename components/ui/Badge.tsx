type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold'

const variantMap: Record<BadgeVariant, string> = {
  success: 'badge-green',
  warning: 'badge-gold',
  danger: 'badge-red',
  info: 'badge-green',
  neutral: 'badge-gray',
  gold: 'badge-gold',
}

type Props = {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'neutral', children, className }: Props) {
  return (
    <span className={`badge ${variantMap[variant]}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  )
}
