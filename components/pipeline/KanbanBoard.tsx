'use client'
import { useState, useEffect } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Lead, PipelineStage } from '@/types'
import { useRouter } from 'next/navigation'

function LeadCard({ lead, isDragging }: { lead: Lead; isDragging?: boolean }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const initials = lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        onClick={() => router.push(`/leads/${lead.id}`)}
        className="card card-hover"
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px 14px', cursor: 'grab', marginBottom: 8, boxShadow: isDragging ? 'var(--shadow-md)' : undefined }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
        </div>
        {lead.people?.name && lead.people.name !== lead.name && (
          <div style={{ fontSize: 10, color: 'var(--gold)', marginBottom: 4, opacity: 0.8 }}>👤 {lead.people.name}</div>
        )}
        {lead.properties && (
          <div style={{ fontSize: 10, color: '#10B981', marginBottom: 4, opacity: 0.8 }}>🏠 {lead.properties.reference ?? lead.properties.title}</div>
        )}
        {(lead.typology || lead.zone) && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            {[lead.typology, lead.zone].filter(Boolean).join(' · ')}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {lead.deal_value ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {(lead.deal_value / 1000).toFixed(0)}K€
            </div>
          ) : lead.budget ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {(lead.budget / 1000).toFixed(0)}K€
            </div>
          ) : (
            <div />
          )}
          {lead.expected_close_date && (
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {new Date(lead.expected_close_date).toLocaleDateString('pt-PT')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  return <div ref={setNodeRef} style={{ minHeight: 120 }}>{children}</div>
}

type Props = {
  initialLeads: Lead[]
  stages: PipelineStage[]
}

export function KanbanBoard({ initialLeads, stages }: Props) {
  const [leads, setLeads] = useState(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Re-sincroniza quando o servidor devolve leads novos (ex: após criar via router.refresh())
  useEffect(() => { setLeads(initialLeads) }, [initialLeads])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const visibleStages = stages.filter(s => !s.is_lost)

  function getStageLeads(stageId: string) {
    return leads.filter(l => l.stage_id === stageId)
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

    const targetStageId = stages.find(s => s.id === over.id)?.id
      ?? leads.find(l => l.id === over.id)?.stage_id

    if (!targetStageId || targetStageId === draggedLead.stage_id) return

    const previous = [...leads]
    setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, stage_id: targetStageId } : l))
    const res = await fetch(`/api/leads/${draggedLead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: targetStageId }),
    })
    if (!res.ok) setLeads(previous)
  }

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  function getColumnTotal(stageId: string): number {
    return getStageLeads(stageId).reduce((sum, l) => sum + (l.deal_value ?? l.budget ?? 0), 0)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="stagger kanban-board" style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0', minHeight: 'calc(100vh - 140px)' }}>
        {visibleStages.map(stage => {
          const stageLeads = getStageLeads(stage.id)
          const columnTotal = getColumnTotal(stage.id)
          return (
            <div key={stage.id} id={stage.id} style={{ minWidth: 240, width: 240, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{stage.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', background: 'var(--border)', padding: '1px 7px', borderRadius: 10 }}>{stageLeads.length}</span>
              </div>
              {columnTotal > 0 && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, paddingLeft: 16 }}>
                  {(columnTotal / 1000).toFixed(0)}K€
                  {stage.probability < 100 && (
                    <span style={{ opacity: 0.6 }}> · {((columnTotal * stage.probability / 100) / 1000).toFixed(0)}K€ pond.</span>
                  )}
                </div>
              )}
              <SortableContext items={stageLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <DroppableColumn id={stage.id}>
                  {stageLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} isDragging={lead.id === activeId} />
                  ))}
                </DroppableColumn>
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
