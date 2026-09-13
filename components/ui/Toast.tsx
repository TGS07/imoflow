'use client'
import { useEffect, useState, useCallback } from 'react'

type ToastItem = { id: number; message: string; type: 'success' | 'error' | 'info' | 'warning' }

const iconMap = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' }

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    function handler(e: Event) {
      const { message, type, id } = (e as CustomEvent).detail
      setToasts(prev => [...prev, { id, message, type }])
      setTimeout(() => remove(id), 4000)
    }
    window.addEventListener('imoflow:toast', handler)
    return () => window.removeEventListener('imoflow:toast', handler)
  }, [remove])

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{iconMap[t.type]}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button className="toast-close" onClick={() => remove(t.id)}>{'✕'}</button>
        </div>
      ))}
    </div>
  )
}
