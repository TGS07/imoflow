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
  const [showPassword, setShowPassword] = useState(false)
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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse 80% 60% at 50% -15%, rgba(176,125,46,0.07), transparent 70%), var(--bg)',
      position: 'relative',
      padding: 20,
    }}>
      <div className="page-enter login-card" style={{
        width: '100%',
        maxWidth: 440,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 24,
        padding: '52px 48px 44px',
        boxShadow: '0 20px 50px rgba(60,44,18,0.08), 0 6px 16px rgba(60,44,18,0.04)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Gold top accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent 10%, #C9A84C 50%, transparent 90%)' }} />

        {/* Logo + brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #C9A84C, #8B6F30)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 6px 20px rgba(176,125,46,0.28), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="font-display" style={{
            fontSize: 28,
            background: 'linear-gradient(120deg, #B07D2E, #8B6F30)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}>
            ImoFlow
          </div>
          <div style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: 5, opacity: 0.75 }}>
            CRM Imobiliário
          </div>
        </div>

        {resetMode ? (
          resetSent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 8 }}>Email enviado!</div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
                Verifica a tua caixa de entrada e clica no link para redefinir a password.
              </p>
              <button onClick={() => { setResetMode(false); setResetSent(false) }} style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
                ← Voltar ao login
              </button>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.2 }}>Recuperar password</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>Insira o email da sua conta</div>
              </div>
              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 500 }}>Email</label>
                  <div style={{ position: 'relative' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.45 }}>
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="nome@empresa.pt"
                      className="input"
                      style={{ paddingLeft: 42, borderRadius: 10, padding: '12px 14px 12px 42px', fontSize: 14 }}
                    />
                  </div>
                </div>
                {error && <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>{error}</div>}
                <button type="submit" disabled={loading} style={{
                  width: '100%', borderRadius: 12, padding: 13, fontSize: 14,
                  fontFamily: 'var(--font-body)', fontWeight: 600,
                  border: '1px solid #7A5520',
                  background: 'linear-gradient(180deg, #C08A38 0%, #A87526 100%)',
                  color: '#fff',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 3px 12px rgba(176,125,46,0.30)',
                  textShadow: '0 1px 1px rgba(90,60,10,0.25)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  marginTop: 8,
                }}>
                  {loading ? 'A enviar...' : 'Enviar link de reset'}
                </button>
                <button type="button" onClick={() => setResetMode(false)} style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontFamily: 'var(--font-body)', marginTop: 4 }}>
                  ← Voltar ao login
                </button>
              </form>
            </>
          )
        ) : (
          <>
            {/* Welcome heading */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.2 }}>Bem-vindo de volta</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>Entre na sua conta para continuar</div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Email */}
              <div>
                <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 500 }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.45 }}>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="nome@empresa.pt"
                    className="input"
                    style={{ paddingLeft: 42, borderRadius: 10, padding: '12px 14px 12px 42px', fontSize: 14 }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Password</label>
                  <button type="button" onClick={() => setResetMode(true)} style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    Esqueceu a password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.45 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="input"
                    style={{ paddingLeft: 42, paddingRight: 42, borderRadius: 10, padding: '12px 42px 12px 42px', fontSize: 14 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                    aria-label={showPassword ? 'Esconder password' : 'Mostrar password'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.4 }}>
                      {showPassword ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              {error && <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>{error}</div>}

              {/* Submit */}
              <button type="submit" disabled={loading} style={{
                width: '100%', borderRadius: 12, padding: 13, fontSize: 14,
                fontFamily: 'var(--font-body)', fontWeight: 600,
                border: '1px solid #7A5520',
                background: 'linear-gradient(180deg, #C08A38 0%, #A87526 100%)',
                color: '#fff',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 3px 12px rgba(176,125,46,0.30)',
                textShadow: '0 1px 1px rgba(90,60,10,0.25)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                marginTop: 8,
                letterSpacing: '0.01em',
              }}>
                {loading ? 'A entrar...' : 'Entrar'}
              </button>
            </form>
          </>
        )}

        {/* Footer links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 28 }}>
          <a href="/termos" style={{ fontSize: 10, color: 'var(--muted)', textDecoration: 'none', opacity: 0.6 }}>Termos de Uso</a>
          <a href="/privacidade" style={{ fontSize: 10, color: 'var(--muted)', textDecoration: 'none', opacity: 0.6 }}>Privacidade</a>
          <a href="/documentacao" style={{ fontSize: 10, color: 'var(--muted)', textDecoration: 'none', opacity: 0.6 }}>Documentação</a>
        </div>
      </div>
    </div>
  )
}
