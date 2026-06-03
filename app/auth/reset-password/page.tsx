'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('A password deve ter pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As passwords não coincidem.'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('Erro ao actualizar password: ' + error.message)
      setLoading(false)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }
  const labelStyle = { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 380, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="font-display" style={{ fontSize: 28, color: 'var(--gold)', marginBottom: 6 }}>ImoFlow</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Nova Password</div>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text)' }}>
            ✅ Password actualizada! A redirecionar...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Nova Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Confirmar Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
            </div>
            {error && <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>{error}</div>}
            <button
              type="submit"
              disabled={loading}
              style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'Jost, sans-serif', marginTop: 8 }}
            >
              {loading ? 'A guardar...' : 'Guardar nova password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
