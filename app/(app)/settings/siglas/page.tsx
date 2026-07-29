'use client'
import { useState, useEffect } from 'react'
import { ContactSigla } from '@/types'

export default function SiglasSettingsPage() {
  const [siglas, setSiglas] = useState<ContactSigla[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-body)' }

  useEffect(() => {
    fetch('/api/contact-siglas')
      .then(r => {
        if (!r.ok) throw new Error('Erro ao carregar siglas')
        return r.json()
      })
      .then((data: ContactSigla[]) => setSiglas(data))
      .catch(() => setLoadError('Não foi possível carregar as siglas.'))
  }, [])

  async function addSigla(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!code.trim() || !label.trim()) return
    setSaving(true)
    const res = await fetch('/api/contact-siglas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, label }),
    })
    setSaving(false)
    if (res.ok) {
      const sigla = await res.json()
      setSiglas(prev => [...prev, sigla].sort((a, b) => a.code.localeCompare(b.code)))
      setCode('')
      setLabel('')
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Não foi possível criar a sigla.')
    }
  }

  return (
    <div className="page-enter page-pad" style={{ padding: '32px 40px', maxWidth: 640 }}>
      <h1 className="font-display" style={{ fontSize: 24, color: 'var(--text)', marginBottom: 6 }}>Siglas de contacto</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>
        Lista de referência das siglas usadas para classificar contactos (ex.: na configuração de contactos do iPhone/iCloud). Esta lista não sincroniza automaticamente com o iPhone.
      </p>

      {loadError && <p style={{ color: 'var(--danger, #EF4444)', fontSize: 13, marginBottom: 16 }}>{loadError}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {siglas.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', minWidth: 48 }}>{s.code}</span>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{s.label}</span>
          </div>
        ))}
        {siglas.length === 0 && !loadError && (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sem siglas ainda.</div>
        )}
      </div>

      <form onSubmit={addSigla} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Criar nova sigla</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input style={{ ...inputStyle, width: 100 }} placeholder="Código" value={code} onChange={e => setCode(e.target.value)} />
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Rótulo" value={label} onChange={e => setLabel(e.target.value)} />
        </div>
        {error && <div style={{ fontSize: 12, color: 'var(--danger, #EF4444)' }}>{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'A criar…' : 'Criar sigla'}
        </button>
      </form>
    </div>
  )
}
