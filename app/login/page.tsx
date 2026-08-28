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
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      {/* Left: Brand panel */}
      <div className="login-brand-panel" style={{
        width: 520,
        flexShrink: 0,
        background: 'linear-gradient(160deg, var(--surface) 0%, var(--card-hover) 40%, var(--bg) 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 48px',
        position: 'relative',
        borderRight: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12), transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -120, left: -60, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(176,125,46,0.08), transparent 70%)' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #C9A84C, #8B6F30)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 24px rgba(176,125,46,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="font-display" style={{
            fontSize: 38,
            background: 'linear-gradient(120deg, #B07D2E, #8B6F30)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: 1.1,
          }}>
            ImoFlow
          </div>
          <div style={{ fontSize: 11, letterSpacing: '0.30em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: 8 }}>
            CRM Imobiliário
          </div>
          <p style={{ marginTop: 36, fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 320 }}>
            Gerencie leads, pipeline e contactos com a plataforma que os melhores consultores imobiliários confiam.
          </p>
        </div>

        <div style={{
          position: 'relative',
          zIndex: 1,
          marginTop: 48,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)',
          maxWidth: 360,
        }}>
          <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
            &ldquo;O ImoFlow transformou a forma como gerimos os nossos contactos. Pipeline claro, follow-ups automáticos, tudo num só lugar.&rdquo;
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #C9A84C, #8B6F30)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: '#FFFFFF',
            }}>TS</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Tomás Sampaio</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>Fundador & CEO</div>
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 24 }}>
          <a href="/termos" style={{ fontSize: 10, color: 'var(--muted)', textDecoration: 'none', opacity: 0.7 }}>Termos de Uso</a>
          <a href="/privacidade" style={{ fontSize: 10, color: 'var(--muted)', textDecoration: 'none', opacity: 0.7 }}>Privacidade</a>
          <a href="/documentacao" style={{ fontSize: 10, color: 'var(--muted)', textDecoration: 'none', opacity: 0.7 }}>Documentação</a>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="login-form-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div className="page-enter" style={{ width: '100%', maxWidth: 380 }}>
          {resetMode ? (
            resetSent ? (
              <div style={{ textAlign: 'center' }}>
                <h1 className="font-display" style={{ fontSize: 26, marginBottom: 8 }}>Email enviado!</h1>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
                  Verifica a tua caixa de entrada e clica no link para redefinir a password.
                </p>
                <button onClick={() => { setResetMode(false); setResetSent(false) }} style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
                  ← Voltar ao login
                </button>
              </div>
            ) : (
              <>
                <h1 className="font-display" style={{ fontSize: 26, marginBottom: 6 }}>Recuperar password</h1>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 32 }}>Insira o email da sua conta.</p>
                <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <label style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 7, fontWeight: 500 }}>Email</label>
                    <div style={{ position: 'relative' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
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
                  <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%', borderRadius: 10 }}>
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
              <h1 className="font-display" style={{ fontSize: 26, marginBottom: 6 }}>Bem-vindo de volta</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 32 }}>Entre na sua conta para continuar.</p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 7, fontWeight: 500 }}>Email</label>
                  <div style={{ position: 'relative' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
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

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                    <label style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Password</label>
                    <button type="button" onClick={() => setResetMode(true)} style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                      Esqueceu a password?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
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

                <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%', borderRadius: 10, marginTop: 4 }}>
                  {loading ? 'A entrar...' : 'Entrar'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
