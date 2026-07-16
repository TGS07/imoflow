'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { PipelineStage, WebForm } from '@/types'
import { OPTIONAL_FORM_FIELDS, WEB_FORM_FIELD_LABELS } from '@/types/web-form'
import type { WebFormField } from '@/types'

export default function EditFormPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<WebFormField[]>([])
  const [stageId, setStageId] = useState<string>('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const inputStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-body)', width: '100%', boxSizing: 'border-box' }

  useEffect(() => {
    Promise.all([
      fetch('/api/pipeline-stages').then(r => r.json()),
      fetch(`/api/forms/${id}`).then(r => r.json()),
    ]).then(([s, f]: [PipelineStage[], WebForm]) => {
      setStages(s)
      setName(f.name)
      setDescription(f.description ?? '')
      setFields((f.fields).filter((field: WebFormField) => !['name', 'email'].includes(field)))
      setStageId(f.stage_id ?? '')
      setIsActive(f.is_active)
      setLoaded(true)
    })
  }, [id])

  function toggleField(field: WebFormField) {
    setFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field])
  }

  function copySnippet() {
    const snippet = `<iframe\n  src="${window.location.origin}/f/${id}"\n  width="100%"\n  height="600"\n  frameborder="0"\n  style="border:none;border-radius:8px;">\n</iframe>`
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Nome é obrigatório.'); return }
    setSaving(true)
    setError(null)
    const allFields: WebFormField[] = ['name', 'email', ...fields]
    const res = await fetch(`/api/forms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, fields: allFields, stage_id: stageId || null, is_active: isActive }),
    })
    if (res.ok) {
      router.push('/settings/forms')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Erro ao guardar.')
      setSaving(false)
    }
  }

  if (!loaded) return <div style={{ padding: '32px 40px', fontSize: 13, color: 'var(--muted)' }}>A carregar...</div>

  const formUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/f/${id}`

  return (
    <div style={{ padding: '32px 40px', maxWidth: 600 }}>
      <h1 className="font-display" style={{ fontSize: 'var(--fs-xl)', marginBottom: 28 }}>Editar Formulário</h1>

      {/* Link directo + snippet */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Incorporar no site</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          Link directo: <a href={formUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }}>{formUrl}</a>
        </p>
        <button
          onClick={copySnippet}
          className="btn btn-ghost btn-sm" style={{ color: copied ? 'var(--green)' : undefined }}
        >
          {copied ? 'Copiado!' : 'Copiar snippet iframe'}
        </button>
      </div>

      {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label htmlFor="edit-name" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome *</label>
          <input id="edit-name" type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label htmlFor="edit-description" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Descrição (opcional)</label>
          <input id="edit-description" type="text" value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
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
          <label htmlFor="edit-stage" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Stage de destino</label>
          <select id="edit-stage" value={stageId} onChange={e => setStageId(e.target.value)} style={inputStyle}>
            <option value="">Primeiro stage do pipeline</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            Formulário activo (visível publicamente)
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'A guardar...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/settings/forms')}
            className="btn btn-ghost"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
