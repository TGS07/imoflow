'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Icon } from '@/components/ui/Icon'

export function LogoutButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="font-display" style={{ fontSize: 'var(--fs-md)', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        Sessão
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text)' }}>Terminar sessão neste dispositivo</div>
        <button
          onClick={handleLogout}
          disabled={loading}
          className="btn"
          style={{ padding: '6px 16px', fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name="logout" size={14} />
          {loading ? 'A sair…' : 'Sair'}
        </button>
      </div>
    </div>
  )
}
