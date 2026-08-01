'use client'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'

type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`
}

type Props = {
  initialTheme: Theme
}

export function ThemeToggle({ initialTheme }: Props) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  // Reconcilia com a base de dados: se este dispositivo ainda não tem cookie
  // (ou tem um valor desatualizado), o valor vindo do servidor (fonte de
  // verdade entre dispositivos) prevalece.
  useEffect(() => {
    if (document.documentElement.dataset.theme !== initialTheme) {
      applyTheme(initialTheme)
      setTheme(initialTheme)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTheme])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
    fetch('/api/users/me/theme', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {
      // dispositivo atual continua correto via cookie; só a sincronização
      // entre dispositivos fica por atualizar até à próxima escrita OK
    })
  }

  return (
    <button
      className="icon-btn"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} />
    </button>
  )
}
