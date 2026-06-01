'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewMemberPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'agent'>('agent')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7,
    padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none',
    fontFamily: 'Jost, sans-serif', width: '100%', boxSizing: 'border-box',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Todos os campos são obrigatórios.')
      return
    }
    if (password.length < 8) {
      setError('A password deve ter pelo menos 8 caracteres.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      })
      if (res.ok) {
        router.push('/settings/team')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Erro ao criar membro.')
      }
    } catch {
      setError('Erro de rede. Verifica a tua ligação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 500 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 28 }}>Adicionar membro</h1>

      {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label htmlFor="member-name" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome completo *</label>
          <input id="member-name" type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Ana Silva" />
        </div>

        <div>
          <label htmlFor="member-email" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Email *</label>
          <input id="member-email" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="ana@agencia.pt" />
        </div>

        <div>
          <label htmlFor="member-password" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Password *</label>
          <input id="member-password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="Mínimo 8 caracteres" />
        </div>

        <div>
          <label htmlFor="member-role" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Role *</label>
          <select id="member-role" value={role} onChange={e => setRole(e.target.value as 'admin' | 'agent')} style={inputStyle}>
            <option value="agent">Agente</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <button
            type="submit"
            disabled={saving}
            style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Jost, sans-serif' }}
          >
            {saving ? 'A criar...' : 'Criar membro'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/settings/team')}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
