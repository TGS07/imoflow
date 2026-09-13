'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { ActivityType } from '@/types'

const ACTIVITY_LABELS: Record<string, string> = {
  chamada: 'Chamada',
  visita: 'Visita',
  email: 'Email',
  reuniao: 'Reunião',
  tarefa: 'Tarefa',
  nota: 'Nota',
}

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

type Props = {
  onCreated?: () => void
}

export function QuickAddFAB({ onCreated }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    type: 'tarefa' as ActivityType,
    title: '',
    due_date: toLocalInput(new Date()),
  })

  // Handle ?create=true query param to auto-open the modal
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setOpen(true)
      // Pre-fill entity association from query params
      const entityType = searchParams.get('entity_type')
      const entityId = searchParams.get('entity_id')
      if (entityType && entityId) {
        // Store in a ref-like state for submission
        setEntityLink({ type: entityType, id: entityId })
      }
    }
  }, [searchParams])

  const [entityLink, setEntityLink] = useState<{ type: string; id: string } | null>(null)

  function handleOpen() {
    setForm({ type: 'tarefa', title: '', due_date: toLocalInput(new Date()) })
    setEntityLink(null)
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
    setEntityLink(null)
    // Clean up query params if present
    if (searchParams.get('create')) {
      router.replace('/activities')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const body: Record<string, unknown> = {
        type: form.type,
        title: form.title,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      }
      // Attach entity link if provided via query params
      if (entityLink) {
        if (entityLink.type === 'lead') body.lead_id = entityLink.id
        else if (entityLink.type === 'person') body.person_id = entityLink.id
        else if (entityLink.type === 'property') body.property_id = entityLink.id
      }
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        handleClose()
        onCreated?.()
        router.refresh()
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <button className="fab" onClick={handleOpen} aria-label="Nova atividade rápida">
        <Icon name="plus" size={22} />
      </button>

      <Modal open={open} onClose={handleClose} title="Atividade rápida" size="sm">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label className="label">Tipo</label>
            <select
              className="input"
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value as ActivityType }))}
            >
              {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Título</label>
            <input
              className="input"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Ex: Ligar ao cliente..."
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Data / Hora</label>
            <input
              type="datetime-local"
              className="input"
              value={form.due_date}
              onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
            />
          </div>
          {entityLink && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', padding: 'var(--space-2) var(--space-3)', background: 'var(--gold-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(176,125,46,0.2)' }}>
              Associada a {entityLink.type === 'lead' ? 'lead' : entityLink.type === 'person' ? 'contacto' : 'imóvel'} #{entityLink.id.slice(0, 8)}...
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={handleClose} className="btn btn-ghost" style={{ flex: 1 }}>
              Cancelar
            </button>
            <button type="submit" disabled={creating} className="btn btn-primary" style={{ flex: 1 }}>
              {creating ? 'A criar...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
