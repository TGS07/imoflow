// components/contacts/InteractionTimeline.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import type { ContactInteraction, InteractionOutcome } from '@/types'
import { AudioRecorder } from '@/components/shared/AudioRecorder'
import { OUTCOMES_BY_TYPE, OUTCOME_LABELS, OUTCOME_COLORS } from '@/lib/contacts/engagement'

const TYPES = [['chamada','Chamada'],['email','Email'],['whatsapp','Mensagem'],['visita','Visita'],['nota','Nota']] as const
const VALID_TYPES = TYPES.map(([v]) => v as string)
const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPES)
const TYPE_ICONS: Record<string, string> = { chamada: '📞', email: '✉️', whatsapp: '💬', visita: '🏠', nota: '📝' }

// Rótulo do resultado consoante o tipo (mensagens no feminino)
function outcomeLabel(type: string, outcome: InteractionOutcome): string {
  if (type === 'whatsapp' && outcome === 'enviado') return 'Enviada'
  if (type === 'whatsapp' && outcome === 'respondido') return 'Respondida'
  if (type === 'chamada' && outcome === 'whatsapp') return 'WhatsApp enviado'
  return OUTCOME_LABELS[outcome]
}

const VISIBLE_COUNT = 5

export function InteractionTimeline({ personId, onLogged }: { personId: string; onLogged?: () => void }) {
  const [items, setItems] = useState<ContactInteraction[]>([])
  const [type, setType] = useState('chamada')
  const [outcome, setOutcome] = useState<InteractionOutcome | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [showRecorder, setShowRecorder] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Nota de voz: a IA devolve tipo + resumo, o agente confirma no "Registar"
  function applyVoice(f: Record<string, unknown>) {
    if (typeof f.type === 'string' && VALID_TYPES.includes(f.type)) { setType(f.type); setOutcome(null) }
    if (typeof f.note === 'string') setNote(f.note)
    setShowRecorder(false)
  }

  const load = useCallback(async () => {
    const res = await fetch(`/api/people/${personId}/interactions`)
    if (res.ok) setItems(await res.json())
  }, [personId])
  useEffect(() => { load() }, [load])

  async function add(withOutcome: InteractionOutcome | null = outcome) {
    if (saving) return
    if (!withOutcome && !note.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/people/${personId}/interactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, note, outcome: withOutcome }),
      })
      if (res.ok) { setNote(''); setOutcome(null); await load(); onLogged?.() }
    } finally { setSaving(false) }
  }

  const outcomes = OUTCOMES_BY_TYPE[type] ?? []
  const visible = showAll ? items : items.slice(0, VISIBLE_COUNT)

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div className="font-display" style={{ fontSize: 15 }}>Registo de contactos</div>
        {items.length > 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{items.length} registo{items.length > 1 ? 's' : ''}</span>}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {TYPES.map(([v, l]) => (
          <button key={v} type="button" onClick={() => { setType(v); setOutcome(null) }} className={`chip${type === v ? ' active' : ''}`} style={{ fontSize: 12 }}>
            {TYPE_ICONS[v]} {l}
          </button>
        ))}
      </div>

      {outcomes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {outcomes.map(o => {
            const active = outcome === o
            const c = OUTCOME_COLORS[o]
            return (
              <button
                key={o}
                type="button"
                disabled={saving}
                onClick={() => setOutcome(active ? null : o)}
                className="chip"
                style={{ fontSize: 12, padding: '6px 14px', ...(active ? { background: `${c}1A`, color: c, borderColor: `${c}66`, fontWeight: 600 } : {}) }}
              >{outcomeLabel(type, o)}</button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          className="input"
          placeholder={outcomes.length > 0 ? 'Nota (opcional)…' : 'Nota…'}
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          style={{ flex: 1, minWidth: 120 }}
        />
        <button
          type="button"
          onClick={() => setShowRecorder(s => !s)}
          title="Nota de voz"
          className="btn btn-ghost"
          style={showRecorder ? { background: 'var(--gold-glow)', borderColor: 'var(--gold)', color: 'var(--gold)' } : undefined}
        >
          🎙
        </button>
        <button className="btn btn-primary" onClick={() => add()} disabled={saving || (!outcome && !note.trim())}>Registar</button>
      </div>
      {showRecorder && (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 10, marginBottom: 14 }}>
          <AudioRecorder entity="interaction" hint="Descreve a interação em voz alta — a IA preenche o tipo e a nota para confirmares." onExtracted={applyVoice} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sem registos.</div>}
        {visible.map(it => (
          <div key={it.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                {TYPE_ICONS[it.type]} {TYPE_LABELS[it.type] ?? it.type}
                {it.outcome && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: `${OUTCOME_COLORS[it.outcome]}1A`, color: OUTCOME_COLORS[it.outcome] }}>
                    {outcomeLabel(it.type, it.outcome)}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {new Date(it.created_at).toLocaleDateString('pt-PT')} · {new Date(it.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {it.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{it.note}</div>}
          </div>
        ))}
        {items.length > VISIBLE_COUNT && (
          <button type="button" onClick={() => setShowAll(s => !s)} className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }}>
            {showAll ? 'Ver menos' : `Ver mais (${items.length - VISIBLE_COUNT})`}
          </button>
        )}
      </div>
    </div>
  )
}
