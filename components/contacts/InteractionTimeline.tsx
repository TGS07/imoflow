// components/contacts/InteractionTimeline.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import type { ContactInteraction } from '@/types'
import { AudioRecorder } from '@/components/shared/AudioRecorder'

const TYPES = [['chamada','Chamada'],['visita','Visita'],['email','Email'],['whatsapp','WhatsApp'],['nota','Nota']] as const
const VALID_TYPES = TYPES.map(([v]) => v as string)

export function InteractionTimeline({ personId, onLogged }: { personId: string; onLogged?: () => void }) {
  const [items, setItems] = useState<ContactInteraction[]>([])
  const [type, setType] = useState('chamada')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [showRecorder, setShowRecorder] = useState(false)

  // Nota de voz: a IA devolve tipo + resumo, o agente confirma no "Registar"
  function applyVoice(f: Record<string, unknown>) {
    if (typeof f.type === 'string' && VALID_TYPES.includes(f.type)) setType(f.type)
    if (typeof f.note === 'string') setNote(f.note)
    setShowRecorder(false)
  }

  const load = useCallback(async () => {
    const res = await fetch(`/api/people/${personId}/interactions`)
    if (res.ok) setItems(await res.json())
  }, [personId])
  useEffect(() => { load() }, [load])

  async function add() {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/people/${personId}/interactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, note }),
      })
      if (res.ok) { setNote(''); await load(); onLogged?.() }
    } finally { setSaving(false) }
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div className="font-display" style={{ fontSize: 15, marginBottom: 14 }}>Interações</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <select className="input" value={type} onChange={e => setType(e.target.value)} style={{ width: 130 }}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className="input" placeholder="Nota..." value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setShowRecorder(s => !s)}
          title="Nota de voz"
          className="btn btn-ghost"
          style={showRecorder ? { background: 'var(--gold-glow)', borderColor: 'var(--gold)', color: 'var(--gold)' } : undefined}
        >
          🎙
        </button>
        <button className="btn btn-primary" onClick={add} disabled={saving}>Registar</button>
      </div>
      {showRecorder && (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 10, marginBottom: 14 }}>
          <AudioRecorder entity="interaction" hint="Descreve a interação em voz alta — a IA preenche o tipo e a nota para confirmares." onExtracted={applyVoice} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sem interações registadas.</div>}
        {items.map(it => (
          <div key={it.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{it.type}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(it.created_at).toLocaleDateString('pt-PT')}</span>
            </div>
            {it.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{it.note}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
