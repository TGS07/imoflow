import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'soft' | 'danger' | 'whatsapp'
type ButtonSize = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', children, loading, className, disabled, ...rest }: Props) {
  const sizeClass = size !== 'md' ? ` btn-${size}` : ''
  return (
    <button
      className={`btn btn-${variant}${sizeClass}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="btn-spinner" />}
      {children}
    </button>
  )
}
