'use client'
import { useState, useEffect } from 'react'
import { Agency } from '@/types'

export default function AdminPage() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin/agencies')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load agencies')
        return r.json()
      })
      .then((data: Agency[]) => { setAgencies(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setMessage('')
    const res = await fetch('/api/admin/agencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(`✓ Agência "${form.name}" criada com sucesso.`)
      setForm({ name: '', email: '', password: '' })
      setAgencies(prev => [data.agency, ...prev])
    } else {
      setMessage(`✗ Erro: ${data.error}`)
    }
    setCreating(false)
  }

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }
  const labelStyle = { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 6 }

  return (
    <>
      <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <h1 className="font-display" style={{ fontSize: 20 }}>Admin — ImoFlow</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Gestão de agências clientes</p>
      </div>
      <div style={{ padding: '28px 32px', display: 'grid', gridTemplateColumns: '380px 1fr', gap: 28 }}>
        {/* FORM */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div className="font-display" style={{ fontSize: 15, marginBottom: 20 }}>Nova Agência</div>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label style={labelStyle}>Nome da Agência</label><input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
            <div><label style={labelStyle}>Email de Acesso</label><input type="email" style={inputStyle} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required /></div>
            <div><label style={labelStyle}>Password Inicial</label><input type="password" style={inputStyle} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={6} /></div>
            {message && <div style={{ fontSize: 12, color: message.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{message}</div>}
            <button type="submit" disabled={creating} style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: 12, fontSize: 13, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1, fontFamily: 'Jost, sans-serif' }}>
              {creating ? 'A criar...' : 'Criar Agência'}
            </button>
          </form>
        </div>

        {/* LISTA */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
            <div className="font-display" style={{ fontSize: 15 }}>Agências Ativas ({agencies.length})</div>
          </div>
          {loading ? (
            <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>A carregar...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Nome', 'Email', 'Plano', 'Criada em'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 22px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agencies.map(a => (
                  <tr key={a.id}>
                    <td style={{ padding: '12px 22px', fontSize: 13, fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>{a.name}</td>
                    <td style={{ padding: '12px 22px', fontSize: 12, color: 'var(--muted)', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>{a.email}</td>
                    <td style={{ padding: '12px 22px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'rgba(201,168,76,0.1)', color: 'var(--gold)' }}>{(a.plan ?? 'free').toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '12px 22px', fontSize: 12, color: 'var(--muted)', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>{new Date(a.created_at).toLocaleDateString('pt-PT')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
