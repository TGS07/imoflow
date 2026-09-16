'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HelpButton } from '@/components/help/HelpButton'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/lib/toast'

type AgencyData = {
  id: string
  name: string
  email: string
  email_from_name: string | null
  email_reply_to: string | null
  followup_first_days: number
  followup_second_days: number
  whatsapp_configured?: boolean
  plan?: string | null
  feed_token?: string | null
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
  const [feedToken, setFeedToken] = useState<string | null>(null)
  const [feedCopied, setFeedCopied] = useState(false)
  const [feedRegenerating, setFeedRegenerating] = useState(false)

  useEffect(() => {
    fetch('/api/agency')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: AgencyData) => {
        setAgency(d)
        setFromName(d.email_from_name ?? '')
        setReplyTo(d.email_reply_to ?? '')
        setFirstDays(String(d.followup_first_days ?? 7))
        setSecondDays(String(d.followup_second_days ?? 30))
        setFeedToken(d.feed_token ?? null)
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

  const feedUrl = feedToken && typeof window !== 'undefined' ? `${window.location.origin}/api/feed/${feedToken}` : ''

  async function copyFeedUrl() {
    if (!feedUrl) return
    await navigator.clipboard.writeText(feedUrl)
    setFeedCopied(true)
    toast('Link do feed copiado.', 'success')
    setTimeout(() => setFeedCopied(false), 2000)
  }

  async function regenerateFeedToken() {
    if (!confirm('Regenerar o token invalida o link atual — qualquer portal já configurado com ele deixa de receber o feed. Continuar?')) return
    setFeedRegenerating(true)
    try {
      const res = await fetch('/api/agency/feed-token', { method: 'POST' })
      if (!res.ok) {
        toast('Não foi possível regenerar o token.', 'error')
        return
      }
      const d = await res.json()
      setFeedToken(d.feed_token)
      toast('Token regenerado.', 'success')
    } catch {
      toast('Erro de rede ao regenerar o token.', 'error')
    } finally {
      setFeedRegenerating(false)
    }
  }

  return (
    <div className="page-enter page-pad" style={{ padding: '32px 40px', maxWidth: 640 }}>
      <h1 className="font-display" style={{ fontSize: 24, color: 'var(--text)', marginBottom: 6 }}>Agência <HelpButton section="agency" /></h1>
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

      {!loading && agency && (
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <h3 className="font-display" style={{ fontSize: 15, marginBottom: 4 }}>Feed XML de imóveis</h3>
          {agency.plan === 'pro' ? (
            <>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                Usa este link para importar os teus imóveis em portais imobiliários (ex: CASA, SAPO). O feed
                inclui apenas os imóveis com estado <strong>disponível</strong> e atualiza-se automaticamente.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                <input
                  readOnly
                  value={feedUrl}
                  onFocus={e => e.target.select()}
                  style={{ flex: 1, minWidth: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)' }}
                />
                <button type="button" onClick={copyFeedUrl} className="btn btn-ghost btn-sm">
                  {feedCopied ? 'Copiado ✓' : 'Copiar'}
                </button>
              </div>
              <button type="button" onClick={regenerateFeedToken} disabled={feedRegenerating} className="btn btn-danger btn-sm">
                {feedRegenerating ? 'A regenerar…' : 'Regenerar token'}
              </button>
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-4)',
                padding: 'var(--space-4) var(--space-5)',
                borderRadius: 'var(--radius)',
                background: 'var(--gold-glow)',
                border: '1px solid rgba(176,125,46,0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: 'var(--gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0D0D0F',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="zap" size={15} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  O feed XML de imóveis é uma funcionalidade <strong>Pro</strong>. Faz upgrade para gerares um
                  link de importação para portais como CASA e SAPO.
                </div>
              </div>
              <Link href="/settings/billing" className="btn btn-primary btn-sm" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                Ver planos
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
