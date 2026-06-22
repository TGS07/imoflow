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

  return (
    <div className="page-enter">
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div className="font-display" style={{ fontSize: 18 }}>Nova Organização</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={createOrg} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="input" placeholder="Nome *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              <input className="input" type="email" placeholder="Email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              <input className="input" placeholder="Telefone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              <input className="input" placeholder="Website" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={creating} className="btn btn-primary" style={{ flex: 1 }}>{creating ? 'A criar...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20 }}>Organizações</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{orgs.length} organizações</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">+ Nova Organização</button>
      </div>

      <div className="page-pad" style={{ padding: '20px 32px' }}>
        <input
          className="input"
          placeholder="Pesquisar por nome ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>Nome</th>
                <th className="hide-mobile" style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>Email</th>
                <th className="hide-mobile" style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>Telefone</th>
                <th className="hide-mobile" style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>Website</th>
                <th style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>Negócios</th>
              </tr>
            </thead>
            <tbody className="stagger">
              {loading && [0, 1, 2, 3].map(i => (
                <tr key={i}><td colSpan={5} style={{ padding: '8px 20px' }}><div className="skeleton" style={{ height: 34 }} /></td></tr>
              ))}
              {!loading && orgs.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Nenhuma organização encontrada.</td></tr>
              )}
              {orgs.map(o => (
                <tr key={o.id} onClick={() => router.push(`/organizations/${o.id}`)} className="table-row" style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🏢</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{o.name}</div>
                        <div className="hide-mobile" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{o.email ?? o.website ?? ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hide-mobile" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>{o.email ?? '—'}</td>
                  <td className="hide-mobile" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>{o.phone ?? '—'}</td>
                  <td className="hide-mobile" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>{o.website ?? '—'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{o.leads?.length ?? 0}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
