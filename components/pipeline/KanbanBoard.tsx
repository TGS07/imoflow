'use client'
import { useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Lead, LeadStage } from '@/types'
import { useRouter } from 'next/navigation'

const STAGES: { id: LeadStage; label: string; color: string }[] = [
  { id: 'lead', label: 'Lead', color: '#5C9EE0' },
  { id: 'visita', label: 'Visita', color: '#9B7FE8' },
  { id: 'proposta', label: 'Proposta', color: '#E0A35C' },
  { id: 'negociacao', label: 'Negociação', color: '#E0595C' },
  { id: 'fechado', label: 'Fechado', color: '#4ECCA3' },
]

function LeadCard({ lead, isDragging }: { lead: Lead; isDragging?: boolean }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const initials = lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        onClick={() => router.push(`/leads/${lead.id}`)}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', cursor: 'grab', marginBottom: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{lead.name}</div>
        </div>
        {(lead.typology || lead.zone) && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            {[lead.typology, lead.zone].filter(Boolean).join(' · ')}
          </div>
        )}
        {lead.budget && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {(lead.budget / 1000).toFixed(0)}K€
          </div>
        )}
      </div>
    </div>
  )
}

type Props = { initialLeads: Lead[] }

export function KanbanBoard({ initialLeads }: Props) {
  const [leads, setLeads] = useState(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function getStageLeads(stage: LeadStage) {
    return leads.filter(l => l.stage === stage)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const draggedLead = leads.find(l => l.id === active.id)
    if (!draggedLead) return

    // Determinar nova stage pelo container (over pode ser o container ou outro card)
    const targetStage = STAGES.find(s => s.id === over.id)?.id
      ?? leads.find(l => l.id === over.id)?.stage

    if (!targetStage || targetStage === draggedLead.stage) return

    const previous = [...leads]
    setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, stage: targetStage } : l))
    const res = await fetch(`/api/leads/${draggedLead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: targetStage }),
    })
    if (!res.ok) setLeads(previous)
  }

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0', minHeight: 'calc(100vh - 140px)' }}>
        {STAGES.map(stage => {
          const stageLeads = getStageLeads(stage.id)
          return (
            <div key={stage.id} id={stage.id} style={{ minWidth: 240, width: 240, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{stage.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', background: 'var(--border)', padding: '1px 7px', borderRadius: 10 }}>{stageLeads.length}</span>
              </div>
              <SortableContext items={stageLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <div style={{ minHeight: 80 }}>
                  {stageLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} isDragging={lead.id === activeId} />
                  ))}
                </div>
              </SortableContext>
            </div>
          )
        })}
      </div>
      <DragOverlay>
        {activeLead && <LeadCard lead={activeLead} />}
      </DragOverlay>
    </DndContext>
  )
}
