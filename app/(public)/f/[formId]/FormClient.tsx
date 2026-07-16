'use client'
import { useState } from 'react'
import type { WebForm } from '@/types'

const TYPOLOGY_OPTIONS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5+']

export function FormClient({ form }: { form: WebForm }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 7,
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
    fontFamily: 'var(--font-body)',
    boxSizing: 'border-box',
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!values.name?.trim()) newErrors.name = 'Campo obrigatório'
    if (!values.email?.trim()) newErrors.email = 'Campo obrigatório'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) newErrors.email = 'Email inválido'
    if (form.fields.includes('budget') && values.budget && isNaN(Number(values.budget))) {
      newErrors.budget = 'Valor numérico inválido'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setGlobalError(null)

    const body: Record<string, unknown> = {
      name: values.name?.trim(),
      email: values.email?.trim(),
    }
    if (values.phone) body.phone = values.phone.trim()
    if (values.zone) body.zone = values.zone.trim()
    if (values.typology) body.typology = values.typology
    if (values.budget) body.budget = Number(values.budget)
    if (values.message) body.message = values.message.trim()

    try {
      const res = await fetch(`/api/f/${form.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setGlobalError(data.error ?? 'Erro ao submeter formulário. Tente novamente.')
      } else {
        setSuccess(true)
      }
    } catch {
      setGlobalError('Erro de ligação. Verifique a sua internet e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Obrigado!</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>Entraremos em contacto em breve.</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 520 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: form.description ? 8 : 28 }}>
        {form.name}
      </h1>
      {form.description && (
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>{form.description}</p>
      )}

      {globalError && (
        <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16, padding: '10px 12px', background: '#EF444415', borderRadius: 7 }}>
          {globalError}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* name — sempre presente */}
        <div>
          <label htmlFor="field-name" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
            Nome completo *
          </label>
          <input
            id="field-name"
            type="text"
            value={values.name ?? ''}
            onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
            style={{ ...inputStyle, borderColor: errors.name ? '#EF4444' : 'var(--border)' }}
            placeholder="João Silva"
            autoComplete="name"
          />
          {errors.name && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{errors.name}</p>}
        </div>

        {/* email — sempre presente */}
        <div>
          <label htmlFor="field-email" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
            Email *
          </label>
          <input
            id="field-email"
            type="email"
            value={values.email ?? ''}
            onChange={e => setValues(v => ({ ...v, email: e.target.value }))}
            style={{ ...inputStyle, borderColor: errors.email ? '#EF4444' : 'var(--border)' }}
            placeholder="joao@exemplo.pt"
            autoComplete="email"
          />
          {errors.email && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{errors.email}</p>}
        </div>

        {form.fields.includes('phone') && (
          <div>
            <label htmlFor="field-phone" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              Telefone
            </label>
            <input
              id="field-phone"
              type="tel"
              value={values.phone ?? ''}
              onChange={e => setValues(v => ({ ...v, phone: e.target.value }))}
              style={inputStyle}
              placeholder="+351 912 345 678"
              autoComplete="tel"
            />
          </div>
        )}

        {form.fields.includes('zone') && (
          <div>
            <label htmlFor="field-zone" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              Zona de interesse
            </label>
            <input
              id="field-zone"
              type="text"
              value={values.zone ?? ''}
              onChange={e => setValues(v => ({ ...v, zone: e.target.value }))}
              style={inputStyle}
              placeholder="Lisboa, Cascais, Porto..."
            />
          </div>
        )}

        {form.fields.includes('typology') && (
          <div>
            <label htmlFor="field-typology" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              Tipologia
            </label>
            <select
              id="field-typology"
              value={values.typology ?? ''}
              onChange={e => setValues(v => ({ ...v, typology: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Selecionar tipologia</option>
              {TYPOLOGY_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        {form.fields.includes('budget') && (
          <div>
            <label htmlFor="field-budget" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              Orçamento (€)
            </label>
            <input
              id="field-budget"
              type="number"
              min="0"
              value={values.budget ?? ''}
              onChange={e => setValues(v => ({ ...v, budget: e.target.value }))}
              style={{ ...inputStyle, borderColor: errors.budget ? '#EF4444' : 'var(--border)' }}
              placeholder="250000"
            />
            {errors.budget && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{errors.budget}</p>}
          </div>
        )}

        {form.fields.includes('message') && (
          <div>
            <label htmlFor="field-message" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              Mensagem
            </label>
            <textarea
              id="field-message"
              value={values.message ?? ''}
              onChange={e => setValues(v => ({ ...v, message: e.target.value }))}
              style={{ ...inputStyle, height: 100, resize: 'vertical' }}
              placeholder="Descreva o que procura..."
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            background: 'var(--gold)',
            color: '#0D0D0F',
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            marginTop: 8,
            fontFamily: 'var(--font-body)',
          }}
        >
          {submitting ? 'A enviar...' : 'Enviar'}
        </button>
      </form>
    </div>
  )
}
