'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Organization } from '@/types'

type LeadSummary = {
  id: string
  name: string
  stage_id: string
  deal_value: number | null
  person_id: string | null
  created_at: string
  pipeline_stages?: { name: string; color: string }
  people?: { name: string }
}

type OrgDetail = Organization & { leads?: LeadSummary[] }

export default function OrganizationPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', website: '', address: '', notes: '' })

  const fetchOrg = useCallback(async () => {
    const res = await fetch(`/api/organizations/${id}`)
    if (!res.ok) return
    const data = await res.json()
    setOrg(data)
    setForm({ name: data.name, email: data.email ?? '', phone: data.phone ?? '', website: data.website ?? '', address: data.address ?? '', notes: data.notes ?? '' })
  }, [id])

  useEffect(() => { fetchOrg() }, [fetchOrg])

  async function save() {
    const res = await fetch(`/api/organizations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        website: form.website || null,
        address: form.address || null,
        notes: form.notes || null,
      }),
    })
    if (res.ok) { setEditing(false); fetchOrg() }
  }

  async function deleteOrg() {
    if (!confirm('Eliminar esta organização? Os leads associados não serão eliminados.')) return
    await fetch(`/api/organizations/${id}`, { method: 'DELETE' })
    router.push('/organizations')
  }

  if (!org) return <div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>A carregar...</div>

  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif', width: '100%' }
  const totalDeals = org.leads?.length ?? 0
  const totalValue = org.leads?.reduce((sum, l) => sum + (l.deal_value ?? 0), 0) ?? 0

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <Link href="/organizations" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13, flexShrink: 0 }}>← Organizações</Link>
          <span style={{ color: 'var(--border)', flexShrink: 0 }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{org.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!editing ? (
            <button onClick={() => setEditing(true)} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Editar</button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Cancelar</button>
              <button onClick={save} style={{ background: 'var(--gold)', border: 'none', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, fontWeight: 600, color: '#0D0D0F', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Guardar</button>
            </>
          )}
          <button onClick={deleteOrg} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, color: '#EF4444', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Eliminar</button>
        </div>
      </div>

      <div className="two-col-grid" style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: Org Info */}
        <div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 8, background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏢</div>
              <div>
                {editing ? (
                  <input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                ) : (
                  <div className="font-display" style={{ fontSize: 18 }}>{org.name}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{totalDeals} negócio{totalDeals !== 1 ? 's' : ''} · {totalValue > 0 ? `€${totalValue.toLocaleString('pt-PT')}` : 'Sem valor'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Email', key: 'email' as const, type: 'email' },
                { label: 'Telefone', key: 'phone' as const },
                { label: 'Website', key: 'website' as const },
                { label: 'Morada', key: 'address' as const },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>{label}</div>
                  {editing ? (
                    <input style={inputStyle} type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                  ) : (
                    <div style={{ fontSize: 13, color: org[key] ? 'var(--text)' : 'var(--muted)' }}>{org[key] ?? '—'}</div>
                  )}
                </div>
              ))}

              <div>
                <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>Notas</div>
                {editing ? (
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' as const }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                ) : (
                  <div style={{ fontSize: 13, color: org.notes ? 'var(--text)' : 'var(--muted)', whiteSpace: 'pre-wrap' }}>{org.notes ?? '—'}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Deals */}
        <div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div className="font-display" style={{ fontSize: 15, marginBottom: 16 }}>Negócios</div>

            {(!org.leads || org.leads.length === 0) ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Nenhum negócio associado.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {org.leads.map(lead => {
                  const stage = lead.pipeline_stages
                  return (
                    <Link key={lead.id} href={`/leads/${lead.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{lead.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            {stage && (
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${stage.color}22`, color: stage.color, fontWeight: 500 }}>{stage.name}</span>
                            )}
                            {lead.people?.name && (
                              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{lead.people.name}</span>
                            )}
                          </div>
                        </div>
                        {lead.deal_value != null && lead.deal_value > 0 && (
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>€{lead.deal_value.toLocaleString('pt-PT')}</div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
