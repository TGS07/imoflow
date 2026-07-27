'use client'
import { useState, useEffect, useRef } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Lead, PipelineStage, PipelineCardField } from '@/types'
import { useRouter } from 'next/navigation'
import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'
import { CardPropertyModal } from '@/components/pipeline/CardPropertyModal'
import { CardHoverPreview } from '@/components/pipeline/CardHoverPreview'
import type { Property } from '@/types'
import { cardFieldValue, daysInStage, type PipelineCardFields } from '@/lib/pipeline/card-fields'

function LeadCard({ lead, isDragging, onOpenContact, cardFields, onDuplicated, onEditProperty, onHoverStart, onHoverEnd }: { lead: Lead; isDragging?: boolean; onOpenContact?: (personId: string, leadId: string) => void; cardFields: PipelineCardFields; onDuplicated?: () => void; onEditProperty?: (lead: Lead) => void; onHoverStart?: (lead: Lead) => void; onHoverEnd?: () => void }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const initials = (lead.people?.name ?? lead.name).split(' ').map((n: string) => n[0]).slice(0, 2).join('')
  const primaryText = cardFieldValue(lead, cardFields.primary) ?? lead.people?.name ?? lead.name
  const secondaryText = cardFieldValue(lead, cardFields.secondary)
  // Campos já mostrados em cima não se repetem nas linhas fixas. Se o
  // primário caiu no fallback (nome), o nome conta como promovido na mesma.
  const promoted = new Set<PipelineCardField>([cardFields.primary, cardFields.secondary])
  if (primaryText === lead.name) promoted.add('name')

  const [duplicating, setDuplicating] = useState(false)

  async function duplicateCard(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Duplicar este card? Cria uma nova entrada para o mesmo contacto, sem imóvel associado.')) return
    setDuplicating(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          zone: lead.zone,
          typology: lead.typology,
          budget: lead.budget,
          notes: lead.notes,
          person_id: lead.person_id,
          organization_id: lead.organization_id,
          property_id: null,
          pipeline_id: lead.pipeline_id,
          stage_id: lead.stage_id,
        }),
      })
      if (res.ok) onDuplicated?.()
    } finally {
      setDuplicating(false)
    }
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        onClick={() => {
          if (lead.person_id && onOpenContact) onOpenContact(lead.person_id, lead.id)
          else router.push(`/leads/${lead.id}`)
        }}
        onMouseEnter={() => onHoverStart?.(lead)}
        onMouseLeave={() => onHoverEnd?.()}
        className="card card-hover"
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px 14px', cursor: 'grab', marginBottom: 8, boxShadow: isDragging ? 'var(--shadow-md)' : undefined }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, whiteSpace: 'normal', wordBreak: 'break-word' as const }}>{primaryText}</div>
          {lead.people?.types && (
            <ContactTypeChips types={lead.people.types} size={8} />
          )}
          <button
            onClick={duplicateCard}
            disabled={duplicating}
            title="Duplicar card"
            className="icon-btn"
            style={{ width: 20, height: 20, fontSize: 11, flexShrink: 0 }}
          >
            ⧉
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEditProperty?.(lead) }}
            title="Imóvel do card"
            className="icon-btn"
            style={{ width: 20, height: 20, fontSize: 11, flexShrink: 0 }}
          >
            🏠
          </button>
        </div>
        {secondaryText && secondaryText !== primaryText && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, whiteSpace: 'normal', wordBreak: 'break-word' as const }}>{secondaryText}</div>
        )}
        {lead.people?.name && lead.people.name !== lead.name && lead.people.name !== primaryText && (
          <div style={{ fontSize: 10, color: 'var(--gold)', marginBottom: 4, opacity: 0.8 }}>👤 {lead.people.name}</div>
        )}
        {!promoted.has('property') && lead.properties && (
          <div style={{ fontSize: 10, color: '#10B981', marginBottom: 4, opacity: 0.8 }}>🏠 {lead.properties.reference ?? lead.properties.title}</div>
        )}
        {(() => {
          const parts = [
            !promoted.has('typology') ? lead.typology : null,
            !promoted.has('zone') ? lead.zone : null,
          ].filter(Boolean)
          return parts.length > 0 ? (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{parts.join(' · ')}</div>
          ) : null
        })()}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!promoted.has('value') && lead.deal_value ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {(lead.deal_value / 1000).toFixed(0)}K€
            </div>
          ) : !promoted.has('value') && lead.budget ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {(lead.budget / 1000).toFixed(0)}K€
            </div>
          ) : (
            <div />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span title="Dias nesta fase" style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: 'var(--border)', color: 'var(--muted)' }}>
              {daysInStage(lead)}d
            </span>
            {lead.expected_close_date && (
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                {new Date(lead.expected_close_date).toLocaleDateString('pt-PT')}
              </div>
            )}
          </div>
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
  onOpenContact?: (personId: string, leadId: string) => void
  cardFields: PipelineCardFields
  onDuplicated?: () => void
  onCardUpdated?: () => void
}

export function KanbanBoard({ initialLeads, stages, onOpenContact, cardFields, onDuplicated, onCardUpdated }: Props) {
  const router = useRouter()
  const [leads, setLeads] = useState(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingProperty, setEditingProperty] = useState<Lead | null>(null)
  const [hoveredLead, setHoveredLead] = useState<Lead | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCardHoverStart(lead: Lead) {
    if (activeId) return
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHoveredLead(lead), 450)
  }

  // Só cancela o temporizador pendente (preview ainda não mostrado). Não
  // fecha um preview já visível — nesse momento o backdrop do
  // CardHoverPreview já cobre o card original, por isso um "mouseleave"
  // deste card nesse instante é um artefacto do backdrop, não uma
  // intenção real do utilizador de sair do preview.
  function handleCardHoverEnd() {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null }
  }

  function openLead(lead: Lead) {
    if (lead.person_id && onOpenContact) onOpenContact(lead.person_id, lead.id)
    else router.push(`/leads/${lead.id}`)
  }

  async function updateCardProperty(patch: { property_id: string | null; zone?: string | null; typology?: string | null; budget?: number | null }) {
    if (!editingProperty) return
    const res = await fetch(`/api/leads/${editingProperty.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      setEditingProperty(null)
      onCardUpdated?.()
    } else {
      alert('Erro ao atualizar o imóvel do card.')
    }
  }

  // Re-sincroniza quando o servidor devolve leads novos (ex: após criar via router.refresh())
  useEffect(() => { setLeads(initialLeads) }, [initialLeads])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const visibleStages = stages.filter(s => !s.is_lost)

  function getStageLeads(stageId: string) {
    return leads.filter(l => l.stage_id === stageId)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null }
    setHoveredLead(null)
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
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="stagger kanban-board" style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0', minHeight: 'calc(100vh - 140px)' }}>
        {visibleStages.map(stage => {
          const stageLeads = getStageLeads(stage.id)
          const columnTotal = getColumnTotal(stage.id)
          return (
            <div key={stage.id} id={stage.id} style={{ minWidth: 300, width: 300, flexShrink: 0 }}>
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
                    <LeadCard key={lead.id} lead={lead} isDragging={lead.id === activeId} onOpenContact={onOpenContact} cardFields={cardFields} onDuplicated={onDuplicated} onEditProperty={setEditingProperty} onHoverStart={handleCardHoverStart} onHoverEnd={handleCardHoverEnd} />
                  ))}
                </DroppableColumn>
              </SortableContext>
            </div>
          )
        })}
      </div>
        <DragOverlay>
          {activeLead && <LeadCard lead={activeLead} onOpenContact={onOpenContact} cardFields={cardFields} onDuplicated={onDuplicated} onEditProperty={setEditingProperty} />}
        </DragOverlay>
      </DndContext>
      {editingProperty && (
        <CardPropertyModal
          currentPropertyId={editingProperty.property_id}
          currentPropertyLabel={editingProperty.properties ? (editingProperty.properties.reference ?? editingProperty.properties.title) : null}
          onClose={() => setEditingProperty(null)}
          onSelect={(property: Property) => updateCardProperty({ property_id: property.id, zone: property.zone, typology: property.typology, budget: property.price })}
          onRemove={() => updateCardProperty({ property_id: null })}
        />
      )}
      {hoveredLead && (
        <CardHoverPreview
          lead={hoveredLead}
          cardFields={cardFields}
          onClick={() => { const lead = hoveredLead; setHoveredLead(null); openLead(lead) }}
          onMouseLeave={() => setHoveredLead(null)}
        />
      )}
    </>
  )
}
