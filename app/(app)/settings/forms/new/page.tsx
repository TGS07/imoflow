'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { PipelineStage } from '@/types'
import { OPTIONAL_FORM_FIELDS, WEB_FORM_FIELD_LABELS } from '@/types/web-form'
import type { WebFormField } from '@/types'

export default function NewFormPage() {
  const router = useRouter()
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<WebFormField[]>(['phone'])
  const [stageId, setStageId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif', width: '100%', boxSizing: 'border-box' }

  useEffect(() => {
    fetch('/api/pipeline-stages').then(r => r.json()).then(setStages)
  }, [])

  function toggleField(field: WebFormField) {
    setFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Nome é obrigatório.'); return }
    setSaving(true)
    setError(null)
    const allFields: WebFormField[] = ['name', 'email', ...fields]
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, fields: allFields, stage_id: stageId || null, is_active: true }),
    })
    if (res.ok) {
      router.push('/settings/forms')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Erro ao criar formulário.')
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 28 }}>Novo Formulário</h1>

      {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label htmlFor="form-name" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome *</label>
          <input id="form-name" type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Formulário do Site" />
        </div>

        <div>
          <label htmlFor="form-description" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Descrição (opcional)</label>
          <input id="form-description" type="text" value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} placeholder="Preencha os seus dados e entraremos em contacto." />
        </div>

        <div>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 10 }}>Campos visíveis</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['name', 'email'] as WebFormField[]).map(field => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', cursor: 'not-allowed', opacity: 0.6 }}>
                <input type="checkbox" checked disabled />
                {WEB_FORM_FIELD_LABELS[field]} (obrigatório)
              </label>
            ))}
            {OPTIONAL_FORM_FIELDS.map(field => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={fields.includes(field)} onChange={() => toggleField(field)} />
                {WEB_FORM_FIELD_LABELS[field]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="form-stage" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Stage de destino</label>
          <select id="form-stage" value={stageId} onChange={e => setStageId(e.target.value)} style={inputStyle}>
            <option value="">Primeiro stage do pipeline</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <button
            type="submit"
            disabled={saving}
            style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Jost, sans-serif' }}
          >
            {saving ? 'A criar...' : 'Criar formulário'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/settings/forms')}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
