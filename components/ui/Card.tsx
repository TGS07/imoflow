import type { ReactNode, HTMLAttributes } from 'react'

type CardVariant = 'default' | 'stat' | 'highlight' | 'interactive'

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant
  children: ReactNode
}

export function Card({ variant = 'default', children, className, ...rest }: Props) {
  const variantClass = variant === 'interactive' ? ' card-hover' : variant !== 'default' ? ` card-${variant}` : ''
  return (
    <div className={`card${variantClass}${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </div>
  )
}
