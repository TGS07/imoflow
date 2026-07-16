'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou password incorretos.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    setLoading(false)
    if (error) { setError('Erro ao enviar email: ' + error.message); return }
    setResetSent(true)
  }

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-body)' }
  const labelStyle = { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(176,125,46,0.08), transparent), var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="page-enter" style={{ width: 380, maxWidth: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 40, boxShadow: 'var(--shadow-lg)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(to right, transparent, var(--gold), transparent)' }} />
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="font-display" style={{ fontSize: 30, marginBottom: 6, background: 'linear-gradient(120deg, #C9A84C, #8B6F30)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>ImoFlow</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>CRM Imobiliário</div>
        </div>

        {resetMode ? (
          resetSent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>✅ Email enviado! Verifica a tua caixa de entrada e clica no link.</div>
              <button onClick={() => { setResetMode(false); setResetSent(false) }} style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Voltar ao login</button>
            </div>
          ) : (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div><label style={labelStyle}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} /></div>
              {error && <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>{error}</div>}
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '12px', marginTop: 8 }}>
                {loading ? 'A enviar...' : 'Enviar link de reset'}
              </button>
              <button type="button" onClick={() => setResetMode(false)} style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Voltar ao login</button>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label style={labelStyle}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} /></div>
            <div><label style={labelStyle}>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} /></div>
            {error && <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '12px', marginTop: 8 }}>
              {loading ? 'A entrar...' : 'Entrar'}
            </button>
            <button type="button" onClick={() => setResetMode(true)} style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginTop: 4 }}>Esqueceu a password?</button>
          </form>
        )}
      </div>
    </div>
  )
}
