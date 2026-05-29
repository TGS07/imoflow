'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Organization } from '@/types'

type OrgWithLeads = Organization & { leads?: { id: string }[] }

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<OrgWithLeads[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', website: '' })
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchOrgs = useCallback(async () => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    try {
      const res = await fetch(`/api/organizations?${params}`)
      if (!res.ok) throw new Error()
      setOrgs(await res.json())
    } catch { setOrgs([]) }
    finally { setLoading(false) }
  }, [debouncedSearch])

  useEffect(() => { fetchOrgs() }, [fetchOrgs])

  async function createOrg(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { setForm({ name: '', email: '', phone: '', website: '' }); setShowForm(false); fetchOrgs() }
    } finally { setCreating(false) }
  }

  const inputStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20 }}>Organizações</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{orgs.length} organizações</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>+ Nova Organização</button>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div className="font-display" style={{ fontSize: 18 }}>Nova Organização</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={createOrg} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input style={{ ...inputStyle, width: '100%' }} placeholder="Nome *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              <input style={{ ...inputStyle, width: '100%' }} type="email" placeholder="Email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              <input style={{ ...inputStyle, width: '100%' }} placeholder="Telefone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              <input style={{ ...inputStyle, width: '100%' }} placeholder="Website" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, ...inputStyle, textAlign: 'center' as const, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={creating} style={{ flex: 1, background: 'var(--gold)', border: 'none', borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 600, color: '#0D0D0F', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>{creating ? 'A criar...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ padding: '20px 32px' }}>
        <input placeholder="Pesquisar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: '100%', marginBottom: 16 }} />
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nome', 'Email', 'Telefone', 'Website', 'Negócios'].map(h => (
                  <th key={h} style={{ textAlign: 'left' as const, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center' as const, color: 'var(--muted)', fontSize: 13 }}>A carregar...</td></tr>}
              {!loading && orgs.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center' as const, color: 'var(--muted)', fontSize: 13 }}>Nenhuma organização encontrada.</td></tr>}
              {orgs.map(o => (
                <tr key={o.id} onClick={() => router.push(`/organizations/${o.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>🏢</div>
                      {o.name}
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{o.email ?? '—'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{o.phone ?? '—'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{o.website ?? '—'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{o.leads?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
