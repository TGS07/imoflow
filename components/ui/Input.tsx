import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...rest }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div>
      {label && <label htmlFor={inputId} className="label">{label}</label>}
      <input id={inputId} className={`input${error ? ' input-error' : ''}${className ? ` ${className}` : ''}`} {...rest} />
      {error && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-xs)', marginTop: 'var(--space-1)' }}>{error}</p>}
    </div>
  )
}
