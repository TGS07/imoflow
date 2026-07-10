'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type Member = {
  id: string
  name: string
  email: string
  role: 'admin' | 'agent'
  avatar_initials: string
  created_at: string
  lead_count: number
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  const [reassignTo, setReassignTo] = useState<string>('')
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    fetch('/api/team')
      .then(r => {
        if (!r.ok) throw new Error('Erro ao carregar equipa')
        return r.json()
      })
      .then(d => {
        setMembers(d.members)
        setCurrentUserId(d.current_user_id)
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar equipa.'); setLoading(false) })
  }, [])

  async function handleRoleChange(id: string, role: 'admin' | 'agent') {
    setUpdatingRole(id)
    const res = await fetch(`/api/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (res.ok) {
      setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m))
    } else {
      setError('Erro ao actualizar role. Tenta novamente.')
    }
    setUpdatingRole(null)
  }

  function openRemove(member: Member) {
    setRemoveTarget(member)
    setReassignTo('')
    setRemoveError(null)
  }

  async function confirmRemove() {
    if (!removeTarget) return
    setRemoving(true)
    setRemoveError(null)
    const res = await fetch(`/api/team/${removeTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reassign_to: reassignTo || null }),
    })
    if (res.ok) {
      setMembers(prev => prev.filter(m => m.id !== removeTarget.id))
      setRemoveTarget(null)
    } else {
      const data = await res.json()
      setRemoveError(data.error ?? 'Erro ao remover membro.')
    }
    setRemoving(false)
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7,
    padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none',
    fontFamily: 'Jost, sans-serif',
  }

  const otherMembers = members.filter(m => m.id !== removeTarget?.id)

  return (
    <div className="page-pad" style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Equipa</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Membros da tua agência e os seus acessos.</p>
        </div>
        <Link
          href="/settings/team/new"
          style={{ background: 'var(--gold)', color: '#0D0D0F', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
        >
          + Adicionar membro
        </Link>
      </div>

      {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>A carregar...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {members.map(member => {
            const isSelf = member.id === currentUserId
            return (
              <div key={member.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
                  {member.avatar_initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{member.name}</span>
                    {isSelf && <span style={{ fontSize: 10, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>tu</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{member.email}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    Desde {new Date(member.created_at).toLocaleDateString('pt-PT')}
                    {member.lead_count > 0 && ` · ${member.lead_count} lead${member.lead_count !== 1 ? 's' : ''}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <select
                    value={member.role}
                    disabled={isSelf || updatingRole === member.id}
                    onChange={e => handleRoleChange(member.id, e.target.value as 'admin' | 'agent')}
                    style={{ ...inputStyle, opacity: isSelf ? 0.4 : 1, cursor: isSelf ? 'not-allowed' : 'pointer' }}
                  >
                    <option value="admin">Admin</option>
                    <option value="agent">Agente</option>
                  </select>
                  <button
                    disabled={isSelf}
                    onClick={() => openRemove(member)}
                    style={{ background: 'none', border: '1px solid #EF4444', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#EF4444', cursor: isSelf ? 'not-allowed' : 'pointer', opacity: isSelf ? 0.3 : 1 }}
                  >
                    Remover
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Remove modal */}
      {removeTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onKeyDown={e => { if (e.key === 'Escape') setRemoveTarget(null) }}
          tabIndex={-1}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 32px', maxWidth: 420, width: '100%' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Remover membro</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              Tens a certeza que queres remover <strong style={{ color: 'var(--text)' }}>{removeTarget.name}</strong>? Esta acção não pode ser desfeita.
            </p>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="reassign-select" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Reatribuir leads para {removeTarget.lead_count > 0 ? `(${removeTarget.lead_count} leads)` : '(opcional)'}:
              </label>
              <select
                id="reassign-select"
                value={reassignTo}
                onChange={e => setReassignTo(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
              >
                <option value="">— Sem reatribuição —</option>
                {otherMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {removeError && <p style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>{removeError}</p>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRemoveTarget(null)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmRemove}
                disabled={removing}
                style={{ background: '#EF4444', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: removing ? 'not-allowed' : 'pointer', opacity: removing ? 0.7 : 1, fontFamily: 'Jost, sans-serif' }}
              >
                {removing ? 'A remover...' : 'Confirmar remoção'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
