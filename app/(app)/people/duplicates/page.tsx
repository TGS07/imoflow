'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import type { Person } from '@/types'
import { normalizePhone, formatPhoneDisplay } from '@/lib/whatsapp/utils'

type PersonWithLeads = Person & { leads?: { id: string }[] }
type DuplicateGroup = { phone: string; people: PersonWithLeads[] }

export default function DuplicatesPage() {
  const [people, setPeople] = useState<PersonWithLeads[]>([])
  const [loading, setLoading] = useState(true)
  const [mergingPhone, setMergingPhone] = useState<string | null>(null)

  const fetchPeople = useCallback(async () => {
    const res = await fetch('/api/people')
    setPeople(res.ok ? await res.json() : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPeople() }, [fetchPeople])

  const groups = useMemo<DuplicateGroup[]>(() => {
    const byPhone = new Map<string, PersonWithLeads[]>()
    for (const p of people) {
      if (!p.phone) continue
      const key = normalizePhone(p.phone)
      if (!key) continue
      const list = byPhone.get(key) ?? []
      list.push(p)
      byPhone.set(key, list)
    }
    return [...byPhone.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([phone, list]) => ({ phone, people: list }))
  }, [people])

  async function keepThis(group: DuplicateGroup, primaryId: string) {
    const primary = group.people.find(p => p.id === primaryId)
    const others = group.people.filter(p => p.id !== primaryId)
    if (!confirm(`Manter "${primary?.name}" e apagar ${others.map(p => `"${p.name}"`).join(', ')}? Esta ação não pode ser desfeita.`)) return
    setMergingPhone(group.phone)
    try {
      for (const p of group.people) {
        if (p.id === primaryId) continue
        const res = await fetch('/api/people/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ primary_id: primaryId, duplicate_id: p.id }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          alert(d.error ?? `Erro ao juntar ${p.name}.`)
          break
        }
      }
    } finally {
      await fetchPeople()
      setMergingPhone(null)
    }
  }

  return (
    <div className="page-enter">
      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20 }}>Contactos duplicados</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{groups.length} grupo(s) com o mesmo telefone</p>
        </div>
        <Link href="/people" className="btn btn-ghost">← Contactos</Link>
      </div>

      <div className="page-pad" style={{ padding: '20px 32px' }}>
        {loading ? (
          <div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>A carregar…</div>
        ) : groups.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Sem duplicados detetados.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {groups.map(group => (
              <div key={group.phone} className="card" style={{ padding: 18 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{formatPhoneDisplay(group.phone)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${group.people.length}, 1fr)`, gap: 12 }}>
                  {group.people.map(p => (
                    <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.email ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Criado em {new Date(p.created_at).toLocaleDateString('pt-PT')}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.leads?.length ?? 0} negócio(s)</div>
                      <Link href={`/people/${p.id}`} style={{ fontSize: 11, color: 'var(--gold)' }}>Ver ficha →</Link>
                      <button
                        onClick={() => keepThis(group, p.id)}
                        disabled={mergingPhone === group.phone}
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 6 }}
                      >
                        {mergingPhone === group.phone ? 'A juntar…' : 'Manter este'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
