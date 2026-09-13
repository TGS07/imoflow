import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

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

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  error?: string
}

export function Select({ label, error, className, children, id, ...rest }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div>
      {label && <label htmlFor={selectId} className="label">{label}</label>}
      <select id={selectId} className={`input${error ? ' input-error' : ''}${className ? ` ${className}` : ''}`} {...rest}>
        {children}
      </select>
      {error && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-xs)', marginTop: 'var(--space-1)' }}>{error}</p>}
    </div>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  error?: string
}

export function Textarea({ label, error, className, id, ...rest }: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div>
      {label && <label htmlFor={textareaId} className="label">{label}</label>}
      <textarea id={textareaId} className={`input${error ? ' input-error' : ''}${className ? ` ${className}` : ''}`} {...rest} />
      {error && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-xs)', marginTop: 'var(--space-1)' }}>{error}</p>}
    </div>
  )
}
