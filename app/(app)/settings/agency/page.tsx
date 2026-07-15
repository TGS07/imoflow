'use client'
import { useState, useEffect } from 'react'
import { Icon } from '@/components/ui/Icon'

type AgencyData = {
  id: string
  name: string
  email: string
  email_from_name: string | null
  email_reply_to: string | null
  followup_first_days: number
  followup_second_days: number
  whatsapp_configured?: boolean
}

export default function AgencySettingsPage() {
  const [agency, setAgency] = useState<AgencyData | null>(null)
  const [fromName, setFromName] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [firstDays, setFirstDays] = useState('7')
  const [secondDays, setSecondDays] = useState('30')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/agency')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: AgencyData) => {
        setAgency(d)
        setFromName(d.email_from_name ?? '')
        setReplyTo(d.email_reply_to ?? '')
        setFirstDays(String(d.followup_first_days ?? 7))
        setSecondDays(String(d.followup_second_days ?? 30))
      })
      .catch(() => setError('Erro ao carregar dados da agência.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/agency', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_from_name: fromName.trim() || null,
          email_reply_to: replyTo.trim() || null,
          followup_first_days: Number(firstDays) || 7,
          followup_second_days: Number(secondDays) || 30,
        }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Erro ao guardar.')
      }
    } catch {
      setError('Erro de rede ao guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-enter page-pad" style={{ padding: '32px 40px', maxWidth: 640 }}>
      <h1 className="font-display" style={{ fontSize: 24, color: 'var(--text)', marginBottom: 6 }}>Agência</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>
        Identidade de envio dos emails — manuais e automáticos.
      </p>

      {loading ? (
        <div className="skeleton" style={{ height: 220 }} />
      ) : (
        <form onSubmit={handleSave} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {agency && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0D0D0F' }}>
                <Icon name="building" size={20} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{agency.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{agency.email}</div>
              </div>
            </div>
          )}

          <div>
            <label className="label">Nome de envio</label>
            <input
              className="input"
              value={fromName}
              onChange={e => setFromName(e.target.value)}
              placeholder={agency?.name ?? 'Nome da agência'}
            />
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
              Aparece como remetente nos emails. Vazio = nome da agência.
            </p>
          </div>

          <div>
            <label className="label">Email de resposta (reply-to)</label>
            <input
              className="input"
              type="email"
              value={replyTo}
              onChange={e => setReplyTo(e.target.value)}
              placeholder="geral@minhaagencia.pt"
            />
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
              Quando a lead responder ao email, a resposta vai para este endereço.
            </p>
          </div>

          <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <label className="label">Lembretes de contactos regulares</label>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 12px' }}>
              Para contactos e leads marcados como <strong>regulares</strong>, avisamos o responsável quando passam demasiados dias sem contacto.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label className="label" style={{ fontSize: 11 }}>1º lembrete (dias)</label>
                <input className="input" type="number" min={1} max={365} value={firstDays} onChange={e => setFirstDays(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label className="label" style={{ fontSize: 11 }}>2º lembrete (dias)</label>
                <input className="input" type="number" min={1} max={365} value={secondDays} onChange={e => setSecondDays(e.target.value)} />
              </div>
            </div>
          </div>

          {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'A guardar…' : 'Guardar'}
            </button>
            {saved && <span className="badge badge-green"><Icon name="check" size={12} /> Guardado</span>}
          </div>
        </form>
      )}

      <div className="card" style={{ padding: 20, marginTop: 16, background: 'var(--surface)' }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
          <strong style={{ color: 'var(--gold)' }}>Domínio próprio:</strong> de momento os emails saem do
          domínio partilhado do ImoFlow. Para enviar diretamente do teu domínio (ex: geral@minhaagencia.pt),
          é preciso verificá-lo no Resend (Domains → Add Domain → adicionar os registos DNS) e definir a
          variável <code style={{ color: 'var(--text)' }}>EMAIL_FROM</code> no servidor.
        </p>
      </div>
    </div>
  )
}
