'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type Audience = 'all' | 'trial' | 'paid' | 'free'
type HistoryItem = {
  id: string
  subject: string
  audience: Audience
  status: 'sending' | 'sent' | 'partial' | 'failed'
  recipient_count: number
  sent_count: number
  failed_count: number
  created_at: string
}

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: 'Todos os utilizadores',
  trial: 'Agências em trial',
  paid: 'Agências com plano pago',
  free: 'Agências no plano gratuito',
}
const STATUS_LABELS: Record<HistoryItem['status'], string> = {
  sending: 'A enviar',
  sent: 'Enviada',
  partial: 'Parcial',
  failed: 'Falhou',
}

const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-body)' }
const labelStyle = { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 6 }

export default function CampaignsPage() {
  const [counts, setCounts] = useState<Record<Audience, number> | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [form, setForm] = useState({ subject: '', body: '', ctaLabel: '', ctaUrl: '', audience: 'all' as Audience })
  const [busy, setBusy] = useState<'test' | 'send' | null>(null)
  const [message, setMessage] = useState('')

  function load() {
    fetch('/api/admin/campaigns')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: { counts: Record<Audience, number>; history: HistoryItem[] }) => {
        setCounts(d.counts)
        setHistory(d.history)
      })
      .catch(() => setMessage('✗ Não foi possível carregar os dados.'))
  }
  useEffect(load, [])

  async function submit(test: boolean) {
    const total = counts?.[form.audience] ?? 0
    if (!test && !window.confirm(`Enviar esta campanha a ${total} destinatário(s) (${AUDIENCE_LABELS[form.audience]})? Não dá para desfazer.`)) return

    setBusy(test ? 'test' : 'send')
    setMessage('')
    const res = await fetch('/api/admin/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, test }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(`✗ ${data.error ?? 'Erro ao enviar.'}`)
    } else if (test) {
      setMessage(`✓ Teste enviado para ${data.to}.`)
    } else {
      setMessage(`✓ Campanha enviada: ${data.sent} enviados, ${data.failed} falhados.`)
      setForm(p => ({ ...p, subject: '', body: '', ctaLabel: '', ctaUrl: '' }))
      load()
    }
    setBusy(null)
  }

  const ready = form.subject.trim() && form.body.trim()

  return (
    <>
      <div className="page-pad" style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <h1 className="font-display" style={{ fontSize: 20 }}>Campanhas — FormaCR</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
          Emails para os utilizadores. Quem cancelou a subscrição não recebe. <Link href="/admin" style={{ color: 'var(--gold)' }}>← Admin</Link>
        </p>
      </div>
      <div className="two-col-grid page-pad" style={{ padding: '28px 32px', display: 'grid', gridTemplateColumns: '460px 1fr', gap: 28 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div className="font-display" style={{ fontSize: 15, marginBottom: 20 }}>Nova campanha</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Audiência</label>
              <select style={inputStyle} value={form.audience} onChange={e => setForm(p => ({ ...p, audience: e.target.value as Audience }))}>
                {(Object.keys(AUDIENCE_LABELS) as Audience[]).map(a => (
                  <option key={a} value={a}>{AUDIENCE_LABELS[a]}{counts ? ` (${counts[a]})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assunto</label>
              <input style={inputStyle} maxLength={150} value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Texto (linha em branco = novo parágrafo)</label>
              <textarea style={{ ...inputStyle, minHeight: 180, resize: 'vertical' }} maxLength={10000} value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Botão (opcional)</label>
                <input style={inputStyle} placeholder="Texto do botão" value={form.ctaLabel} onChange={e => setForm(p => ({ ...p, ctaLabel: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Link do botão</label>
                <input style={inputStyle} placeholder="https://…" value={form.ctaUrl} onChange={e => setForm(p => ({ ...p, ctaUrl: e.target.value }))} />
              </div>
            </div>
            {message && <div style={{ fontSize: 12, color: message.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{message}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" disabled={!ready || !!busy} onClick={() => submit(true)} style={{ flex: 1, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, cursor: !ready || busy ? 'not-allowed' : 'pointer', opacity: !ready || busy ? 0.6 : 1, fontFamily: 'var(--font-body)' }}>
                {busy === 'test' ? 'A enviar…' : 'Enviar teste para mim'}
              </button>
              <button type="button" disabled={!ready || !!busy} onClick={() => submit(false)} style={{ flex: 1, background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: 12, fontSize: 13, fontWeight: 600, cursor: !ready || busy ? 'not-allowed' : 'pointer', opacity: !ready || busy ? 0.6 : 1, fontFamily: 'var(--font-body)' }}>
                {busy === 'send' ? 'A enviar…' : 'Enviar campanha'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div className="font-display" style={{ fontSize: 15, marginBottom: 16 }}>Histórico</div>
          {history.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Ainda não enviaste nenhuma campanha.</div>
          ) : (
            history.map(h => (
              <div key={h.id} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{h.subject}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {new Date(h.created_at).toLocaleString('pt-PT')} · {AUDIENCE_LABELS[h.audience]} · {STATUS_LABELS[h.status]} · {h.sent_count}/{h.recipient_count} enviados{h.failed_count ? `, ${h.failed_count} falhados` : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
