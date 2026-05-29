'use client'
import { useState, useEffect } from 'react'
import { LeadSource, CustomField } from '@/types'

type Props = {
  onClose: () => void
  onCreated: () => void
}

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'site', label: '🌐 Site' },
  { value: 'instagram', label: '📱 Instagram' },
  { value: 'facebook', label: '📘 Facebook' },
  { value: 'referencia', label: '👤 Referência' },
  { value: 'outro', label: '◯ Outro' },
]

export function NewLeadModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'site' as LeadSource, zone: '', typology: '', budget: '', deal_value: '', expected_close_date: '' })
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }
  const labelStyle = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 5 }

  useEffect(() => {
    fetch('/api/custom-fields').then(r => r.json()).then(setCustomFields)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const cfValues: Record<string, string | number | null> = {}
      for (const field of customFields) {
        const raw = customValues[field.id]
        if (!raw && field.required) return
        if (!raw) continue
        if (field.field_type === 'number' || field.field_type === 'currency') {
          cfValues[field.id] = Number(raw)
        } else {
          cfValues[field.id] = raw
        }
      }

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          budget: form.budget ? Number(form.budget) : null,
          deal_value: form.deal_value ? Number(form.deal_value) : null,
          expected_close_date: form.expected_close_date || null,
          custom_fields: Object.keys(cfValues).length > 0 ? cfValues : undefined,
        }),
      })
      if (!res.ok) throw new Error('Erro ao criar lead')
      onCreated()
      onClose()
    } catch {
      // keep modal open on error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 18 }}>Novo Lead</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={labelStyle}>Nome *</label><input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><label style={labelStyle}>Telefone</label><input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Zona</label><input style={inputStyle} value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} placeholder="Ex: Cascais" /></div>
            <div><label style={labelStyle}>Tipologia</label><input style={inputStyle} value={form.typology} onChange={e => setForm(p => ({ ...p, typology: e.target.value }))} placeholder="Ex: T3" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Orcamento (€)</label><input type="number" style={inputStyle} value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="Ex: 350000" /></div>
            <div>
              <label style={labelStyle}>Origem</label>
              <select style={{ ...inputStyle }} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value as LeadSource }))}>
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10, fontWeight: 600 }}>Negocio</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Valor do Negocio (€)</label><input type="number" style={inputStyle} value={form.deal_value} onChange={e => setForm(p => ({ ...p, deal_value: e.target.value }))} placeholder="Ex: 15000" /></div>
              <div><label style={labelStyle}>Data Prevista de Fecho</label><input type="date" style={inputStyle} value={form.expected_close_date} onChange={e => setForm(p => ({ ...p, expected_close_date: e.target.value }))} /></div>
            </div>
          </div>

          {customFields.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10, fontWeight: 600 }}>Campos Personalizados</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {customFields.map(field => (
                  <div key={field.id}>
                    <label style={labelStyle}>{field.name}{field.required ? ' *' : ''}</label>
                    {field.field_type === 'select' ? (
                      <select
                        style={inputStyle}
                        value={customValues[field.id] ?? ''}
                        onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                        required={field.required}
                      >
                        <option value="">Selecionar...</option>
                        {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.field_type === 'boolean' ? (
                      <select
                        style={inputStyle}
                        value={customValues[field.id] ?? ''}
                        onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                      >
                        <option value="">—</option>
                        <option value="true">Sim</option>
                        <option value="false">Nao</option>
                      </select>
                    ) : (
                      <input
                        type={field.field_type === 'number' || field.field_type === 'currency' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                        style={inputStyle}
                        value={customValues[field.id] ?? ''}
                        onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 11, fontSize: 13, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ flex: 1, background: 'var(--gold)', border: 'none', borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 600, color: '#0D0D0F', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Jost, sans-serif' }}>
              {loading ? 'A criar...' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
