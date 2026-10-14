'use client'
import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'

type Webhook = {
  id: string
  name: string
  token: string
  pipeline_id: string | null
  stage_id: string | null
  assigned_to: string | null
  is_active: boolean
  lead_count: number
  last_used_at: string | null
  created_at: string
  pipelines?: { name: string } | null
  pipeline_stages?: { name: string } | null
  users?: { name: string } | null
}

type Option = { id: string; name: string }

const EXAMPLE_BODY = `{
  "name": "Maria Silva",
  "phone": "912345678",
  "email": "maria@email.com",
  "message": "Procuro T2 em Lisboa até 300.000€",
  "source": "instagram",
  "campaign": "Campanha T2 Lisboa"
}`

// Ligações externas de leads: o parceiro envia um POST com a chave e a lead
// entra direto na pipeline escolhida.
export default function IntegrationsPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [pipelines, setPipelines] = useState<Option[]>([])
  const [members, setMembers] = useState<Option[]>([])
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, (Option & { is_lost?: boolean })[]>>({})
  const [form, setForm] = useState({ name: '', pipeline_id: '', stage_id: '', assigned_to: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, string>>({})
  // Origem do site (vazia no render do servidor, sem mismatch na hidratação)
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => '')

  const endpoint = `${origin}/api/inbound/leads`

  const load = useCallback(async () => {
    const res = await fetch('/api/lead-webhooks')
    if (res.ok) setWebhooks(await res.json())
    else setError('Erro ao carregar as ligações.')
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetch('/api/pipelines').then(r => r.ok ? r.json() : []).then(setPipelines).catch(() => {})
    fetch('/api/team/members').then(r => r.ok ? r.json() : { members: [] }).then((d: { members: Option[] }) => setMembers(d.members)).catch(() => {})
  }, [load])

  const loadStages = useCallback((pipelineId: string) => {
    if (!pipelineId || stagesByPipeline[pipelineId]) return
    fetch(`/api/pipeline-stages?pipeline_id=${pipelineId}`)
      .then(r => r.ok ? r.json() : [])
      .then(s => setStagesByPipeline(prev => ({ ...prev, [pipelineId]: s })))
      .catch(() => {})
  }, [stagesByPipeline])

  useEffect(() => { webhooks.forEach(w => w.pipeline_id && loadStages(w.pipeline_id)) }, [webhooks, loadStages])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/lead-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Erro ao criar a ligação.'); return }
      setWebhooks(prev => [...prev, data])
      setRevealed(prev => new Set(prev).add(data.id))
      setForm({ name: '', pipeline_id: '', stage_id: '', assigned_to: '' })
    } finally { setCreating(false) }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/lead-webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { alert(data.error ?? 'Erro ao guardar.'); return }
    setWebhooks(prev => prev.map(w => w.id === id ? data : w))
  }

  async function remove(w: Webhook) {
    if (!confirm(`Eliminar a ligação «${w.name}»? O parceiro deixa de conseguir enviar leads. As leads já recebidas ficam.`)) return
    const res = await fetch(`/api/lead-webhooks/${w.id}`, { method: 'DELETE' })
    if (res.ok) setWebhooks(prev => prev.filter(x => x.id !== w.id))
  }

  function regenerate(w: Webhook) {
    if (!confirm('Gerar uma chave nova? A chave atual deixa de funcionar de imediato e terás de enviar a nova ao parceiro.')) return
    patch(w.id, { regenerate_token: true })
    setRevealed(prev => new Set(prev).add(w.id))
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(c => c === key ? null : c), 1800)
    } catch {}
  }

  async function test(w: Webhook) {
    setTestResult(prev => ({ ...prev, [w.id]: 'A testar…' }))
    const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${w.token}` } }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setTestResult(prev => ({ ...prev, [w.id]: res?.ok ? '✓ Ligação a funcionar' : `✗ ${data.error ?? 'Sem resposta'}` }))
  }

  function partnerMessage(w: Webhook): string {
    return [
      'Dados para enviar as leads para o nosso CRM:',
      '',
      `Endereço (POST): ${endpoint}`,
      `Cabeçalho: Authorization: Bearer ${w.token}`,
      'Formato: JSON (também aceita form-urlencoded)',
      '',
      'Campos (obrigatório: telefone ou email):',
      EXAMPLE_BODY,
      '',
      'Também aceita os nomes em português (nome, telefone, mensagem, origem, zona, tipologia, orcamento).',
      'Resposta 201 = lead criada; 200 com "duplicate": true = contacto já estava na pipeline.',
    ].join('\n')
  }

  const label = { fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' } as const
  const codeBox = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', overflowX: 'auto', whiteSpace: 'nowrap', flex: 1, minWidth: 0 } as const

  const formStages = (stagesByPipeline[form.pipeline_id] ?? []).filter(s => !s.is_lost)

  return (
    <div className="page-pad" style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="font-display" style={{ fontSize: 'var(--fs-xl)', marginBottom: 4 }}>Integrações</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          Recebe leads de parceiros, formulários do Instagram/Facebook, sites ou ferramentas como Make e Zapier.
          Cria uma ligação por parceiro e envia-lhe o endereço e a chave — cada lead que ele enviar entra logo na pipeline,
          cria o contacto (sem duplicar) e recebes uma notificação.
        </p>
      </div>

      <form onSubmit={create} className="card" style={{ padding: 20, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
        <div>
          <span style={label}>Nome da ligação</span>
          <input className="input" placeholder="Ex: Parceiro Instagram" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <span style={label}>Pipeline</span>
          <select className="input" value={form.pipeline_id} onChange={e => { setForm(f => ({ ...f, pipeline_id: e.target.value, stage_id: '' })); loadStages(e.target.value) }}>
            <option value="">Primeira pipeline</option>
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <span style={label}>Fase</span>
          <select className="input" value={form.stage_id} onChange={e => setForm(f => ({ ...f, stage_id: e.target.value }))} disabled={!form.pipeline_id}>
            <option value="">Primeira fase</option>
            {formStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <span style={label}>Responsável</span>
          <select className="input" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
            <option value="">Sem responsável (avisa o admin)</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={creating || !form.name.trim()}>{creating ? 'A criar…' : '+ Criar ligação'}</button>
      </form>

      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>A carregar…</p>
      ) : webhooks.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Ainda não há ligações. Cria a primeira acima.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {webhooks.map(w => {
            const shown = revealed.has(w.id)
            const stages = (w.pipeline_id ? stagesByPipeline[w.pipeline_id] ?? [] : []).filter(s => !s.is_lost)
            return (
              <div key={w.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, opacity: w.is_active ? 1 : 0.7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{w.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: w.is_active ? '#16A34A1A' : '#6B72801A', color: w.is_active ? '#16A34A' : '#6B7280' }}>
                    {w.is_active ? 'Ativa' : 'Desativada'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
                    {w.lead_count} lead{w.lead_count === 1 ? '' : 's'} recebida{w.lead_count === 1 ? '' : 's'}
                    {w.last_used_at && ` · último envio ${new Date(w.last_used_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                </div>

                <div>
                  <span style={label}>Endereço (POST)</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <code style={codeBox}>{endpoint}</code>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(endpoint, `url-${w.id}`)}>{copied === `url-${w.id}` ? '✓' : 'Copiar'}</button>
                  </div>
                </div>
                <div>
                  <span style={label}>Chave secreta</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <code style={codeBox}>{shown ? w.token : `${w.token.slice(0, 8)}${'•'.repeat(24)}`}</code>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevealed(prev => { const n = new Set(prev); if (n.has(w.id)) n.delete(w.id); else n.add(w.id); return n })}>{shown ? 'Esconder' : 'Mostrar'}</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(w.token, `key-${w.id}`)}>{copied === `key-${w.id}` ? '✓' : 'Copiar'}</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <div>
                    <span style={label}>Pipeline</span>
                    <select className="input" value={w.pipeline_id ?? ''} onChange={e => { loadStages(e.target.value); patch(w.id, { pipeline_id: e.target.value, stage_id: null }) }}>
                      <option value="">Primeira pipeline</option>
                      {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={label}>Fase</span>
                    <select className="input" value={w.stage_id ?? ''} disabled={!w.pipeline_id} onChange={e => patch(w.id, { stage_id: e.target.value })}>
                      <option value="">Primeira fase</option>
                      {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={label}>Responsável</span>
                    <select className="input" value={w.assigned_to ?? ''} onChange={e => patch(w.id, { assigned_to: e.target.value })}>
                      <option value="">Sem responsável (avisa o admin)</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => copy(partnerMessage(w), `msg-${w.id}`)}>
                    {copied === `msg-${w.id}` ? '✓ Copiado' : 'Copiar instruções para o parceiro'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => test(w)}>Testar ligação</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(w.id, { is_active: !w.is_active })}>{w.is_active ? 'Desativar' : 'Ativar'}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => regenerate(w)}>Gerar nova chave</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(w)}>Eliminar</button>
                  {testResult[w.id] && <span style={{ fontSize: 12, color: testResult[w.id].startsWith('✓') ? '#16A34A' : testResult[w.id].startsWith('✗') ? 'var(--red)' : 'var(--muted)' }}>{testResult[w.id]}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card" style={{ padding: 20, marginTop: 24 }}>
        <div className="font-display" style={{ fontSize: 15, marginBottom: 10 }}>Como o parceiro envia as leads</div>
        <ol style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, paddingLeft: 18, margin: '0 0 12px' }}>
          <li>Na ferramenta dele (Make, Zapier, n8n, o próprio site…) cria um pedido <strong>HTTP POST</strong> para o endereço acima.</li>
          <li>Adiciona o cabeçalho <code>Authorization: Bearer &lt;chave&gt;</code> (ou <code>?key=&lt;chave&gt;</code> no fim do endereço, se a ferramenta não deixar pôr cabeçalhos).</li>
          <li>Envia os dados da lead em JSON. Basta telefone ou email; o resto é opcional.</li>
        </ol>
        <pre style={{ ...codeBox, whiteSpace: 'pre', display: 'block', margin: 0 }}>{EXAMPLE_BODY}</pre>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
          Aceita também nomes em português (nome, telefone, mensagem, origem, zona, tipologia, orcamento) e o formato dos formulários do Meta.
          Campos desconhecidos ficam nas notas da lead. Se o contacto já estiver na mesma pipeline, não se cria card repetido — o pedido fica no historial do contacto.
        </p>
      </div>
    </div>
  )
}
