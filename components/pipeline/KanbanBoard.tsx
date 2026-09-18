'use client'
import { useState, useEffect, useRef } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Lead, PipelineStage, PipelineCardField, Pipeline } from '@/types'
import { useRouter } from 'next/navigation'
import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'
import { CardPropertyModal } from '@/components/pipeline/CardPropertyModal'
import { CardHoverPreview } from '@/components/pipeline/CardHoverPreview'
import { Icon } from '@/components/ui/Icon'
import type { ContactPropertyCandidate } from '@/lib/pipeline/resolve-contact-property'
import { cardFieldValue, daysInStage, CARD_FIELD_LABELS, type PipelineCardFields } from '@/lib/pipeline/card-fields'

function daysPillColor(days: number): string {
  if (days < 7) return 'kanban-days-green'
  if (days <= 14) return 'kanban-days-amber'
  return 'kanban-days-red'
}

function LeadCard({ lead, isDragging, onOpenContact, cardFields, onDuplicated, onEditProperty, onHoverStart, onHoverEnd, selected, onSelect, onRemove }: {
  lead: Lead; isDragging?: boolean; onOpenContact?: (personId: string, leadId: string) => void; cardFields: PipelineCardFields; onDuplicated?: () => void; onEditProperty?: (lead: Lead) => void; onHoverStart?: (lead: Lead) => void; onHoverEnd?: () => void
  selected?: boolean; onSelect?: (id: string, checked: boolean) => void; onRemove?: (id: string) => void
}) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const initials = (lead.people?.name ?? lead.name).split(' ').map((n: string) => n[0]).slice(0, 2).join('')

  const fields = cardFields.all
  const shown = new Set<PipelineCardField>()

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
          name: lead.name, email: lead.email, phone: lead.phone, source: lead.source,
          zone: lead.zone, typology: lead.typology, budget: lead.budget, notes: lead.notes,
          person_id: lead.person_id, organization_id: lead.organization_id, property_id: null,
          pipeline_id: lead.pipeline_id, stage_id: lead.stage_id,
        }),
      })
      if (res.ok) onDuplicated?.()
    } finally { setDuplicating(false) }
  }

  function renderFieldBadge(field: PipelineCardField) {
    if (shown.has(field)) return null
    const val = cardFieldValue(lead, field)
    if (!val) return null
    shown.add(field)

    const badgeStyle: React.CSSProperties = {
      fontSize: 11, padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' as const,
      color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)',
    }

    return <span key={field} style={badgeStyle}>{val}</span>
  }

  const nameVal = lead.people?.name ?? lead.name
  const phoneVal = lead.people?.phone ?? lead.phone
  shown.add('name')
  if (phoneVal) shown.add('phone')

  const badges = fields.filter(f => f !== 'name' && f !== 'phone').map(renderFieldBadge).filter(Boolean)
  const adaptiveFont = fields.length <= 4 ? 12 : 11

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        onClick={() => {
          if (lead.person_id && onOpenContact) onOpenContact(lead.person_id, lead.id)
          else router.push(`/leads/${lead.id}`)
        }}
        onMouseEnter={() => onHoverStart?.(lead)}
        onMouseLeave={() => onHoverEnd?.()}
        className={`kanban-card card-hover${selected ? ' kanban-card-selected' : ''}`}
        style={isDragging ? { boxShadow: 'var(--shadow-md)' } : undefined}
      >
        {/* Header: checkbox + avatar + name + phone */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {onSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={e => { e.stopPropagation(); onSelect(lead.id, e.target.checked) }}
              onClick={e => e.stopPropagation()}
              className="kanban-checkbox"
              style={{ width: 14, height: 14, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--gold)' }}
            />
          )}
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameVal}</div>
            {phoneVal && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{phoneVal}</div>}
          </div>
          {lead.people?.types && <ContactTypeChips types={lead.people.types} size={8} />}
          <div className="kanban-card-actions">
            <button onClick={duplicateCard} disabled={duplicating} onMouseEnter={() => onHoverEnd?.()} title="Duplicar card" className="icon-btn" style={{ width: 20, height: 20, flexShrink: 0 }}>
              <Icon name="form" size={12} />
            </button>
            <button onClick={e => { e.stopPropagation(); onEditProperty?.(lead) }} onMouseEnter={() => onHoverEnd?.()} title="Imóvel do card" className="icon-btn" style={{ width: 20, height: 20, flexShrink: 0 }}>
              <Icon name="home" size={12} />
            </button>
            {onRemove && (
              <button
                onClick={e => { e.stopPropagation(); onRemove(lead.id) }}
                onMouseEnter={() => onHoverEnd?.()}
                title="Remover da pipeline"
                className="icon-btn"
                style={{ width: 20, height: 20, flexShrink: 0 }}
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Field badges */}
        {badges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, fontSize: adaptiveFont }}>
            {badges}
          </div>
        )}

        {/* Property ref (if not already in badges) */}
        {!shown.has('property') && !shown.has('property_ref') && lead.properties && (
          <div style={{ fontSize: 11, color: '#10B981', marginBottom: 4, opacity: 0.8 }}>
            <Icon name="home" size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
            {lead.properties.reference ?? lead.properties.title}
          </div>
        )}

        {/* Footer: days + date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <div />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span title="Dias nesta fase" className={`kanban-days-pill ${daysPillColor(daysInStage(lead))}`}>
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

function DroppablePipelineTab({ pipeline, isOver }: { pipeline: Pipeline; isOver?: boolean }) {
  const { setNodeRef, isOver: dndIsOver } = useDroppable({ id: `pipeline-tab-${pipeline.id}` })
  const active = isOver ?? dndIsOver
  return (
    <div
      ref={setNodeRef}
      style={{
        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
        border: active ? '2px solid var(--gold)' : '1px dashed var(--border)',
        background: active ? 'var(--gold-bg)' : 'var(--surface)',
        color: active ? 'var(--gold)' : 'var(--muted)',
        transition: 'all 0.15s',
        cursor: 'default',
      }}
    >
      ↗ {pipeline.name}
    </div>
  )
}

type Props = {
  initialLeads: Lead[]
  stages: PipelineStage[]
  pipelines?: Pipeline[]
  currentPipelineId?: string | null
  onOpenContact?: (personId: string, leadId: string) => void
  cardFields: PipelineCardFields
  onDuplicated?: () => void
  onCardUpdated?: () => void
}

export function KanbanBoard({ initialLeads, stages, pipelines, currentPipelineId, onOpenContact, cardFields, onDuplicated, onCardUpdated }: Props) {
  const router = useRouter()
  const [leads, setLeads] = useState(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingProperty, setEditingProperty] = useState<Lead | null>(null)
  const [hoveredLead, setHoveredLead] = useState<Lead | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function handleSelect(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id); else next.delete(id)
      return next
    })
  }

  function clearSelection() { setSelectedIds(new Set()) }

  async function bulkMoveToStage(stageId: string) {
    const ids = [...selectedIds]
    const previous = [...leads]
    setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, stage_id: stageId, stage_entered_at: new Date().toISOString() } : l))
    clearSelection()
    const res = await fetch('/api/leads/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, stage_id: stageId }),
    })
    if (!res.ok) setLeads(previous)
  }

  async function bulkMoveToPipeline(pipelineId: string) {
    const ids = [...selectedIds]
    const previous = [...leads]
    setLeads(prev => prev.filter(l => !ids.includes(l.id)))
    clearSelection()
    const results = await Promise.all(
      ids.map(id => fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_id: pipelineId }),
      }))
    )
    if (results.some(r => !r.ok)) setLeads(previous)
    else onCardUpdated?.()
  }

  function selectColumn(stageId: string) {
    const stageLeadIds = leads.filter(l => l.stage_id === stageId).map(l => l.id)
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSelected = stageLeadIds.every(id => next.has(id))
      if (allSelected) stageLeadIds.forEach(id => next.delete(id))
      else stageLeadIds.forEach(id => next.add(id))
      return next
    })
  }

  async function bulkRemove() {
    if (!confirm(`Remover ${selectedIds.size} card(s) da pipeline? Os contactos não serão eliminados.`)) return
    const ids = [...selectedIds]
    const previous = [...leads]
    setLeads(prev => prev.filter(l => !ids.includes(l.id)))
    clearSelection()
    const res = await fetch('/api/leads/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, remove: true }),
    })
    if (!res.ok) setLeads(previous)
    else onCardUpdated?.()
  }

  async function removeCard(id: string) {
    if (!confirm('Remover da pipeline? O contacto não será eliminado.')) return
    const previous = [...leads]
    setLeads(prev => prev.filter(l => l.id !== id))
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (!res.ok) setLeads(previous)
    else onCardUpdated?.()
  }

  function handleCardHoverStart(lead: Lead) {
    if (activeId) return
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHoveredLead(lead), 4500)
  }

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
    if (res.ok) { setEditingProperty(null); onCardUpdated?.() }
    else alert('Erro ao atualizar o imóvel do card.')
  }

  useEffect(() => { setLeads(initialLeads) }, [initialLeads])
  useEffect(() => { clearSelection() }, [currentPipelineId])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const visibleStages = stages.filter(s => !s.is_lost)
  const otherPipelines = (pipelines ?? []).filter(p => p.id !== currentPipelineId)

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

    const overId = over.id as string

    // Cross-pipeline drop
    if (overId.startsWith('pipeline-tab-')) {
      const targetPipelineId = overId.replace('pipeline-tab-', '')
      const previous = [...leads]
      setLeads(prev => prev.filter(l => l.id !== draggedLead.id))
      const res = await fetch(`/api/leads/${draggedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_id: targetPipelineId }),
      })
      if (!res.ok) setLeads(previous)
      else onCardUpdated?.()
      return
    }

    // Same-pipeline stage move
    const targetStageId = stages.find(s => s.id === overId)?.id
      ?? leads.find(l => l.id === overId)?.stage_id

    if (!targetStageId || targetStageId === draggedLead.stage_id) return

    const previous = [...leads]
    setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, stage_id: targetStageId, stage_entered_at: new Date().toISOString() } : l))
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
        {/* Cross-pipeline drop targets (visible during drag only) */}
        {activeId && otherPipelines.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, padding: '8px 0' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>Mover para:</span>
            {otherPipelines.map(p => (
              <DroppablePipelineTab key={p.id} pipeline={p} />
            ))}
          </div>
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="kanban-bulk-bar" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', marginBottom: 12,
            background: 'var(--card)', border: '1px solid var(--gold)', borderRadius: 10,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
              <select
                className="input"
                style={{ width: 'auto', fontSize: 12 }}
                value=""
                onChange={e => { if (e.target.value) bulkMoveToStage(e.target.value) }}
              >
                <option value="">Mover para fase…</option>
                {visibleStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {otherPipelines.length > 0 && (
                <select
                  className="input"
                  style={{ width: 'auto', fontSize: 12 }}
                  value=""
                  onChange={e => { if (e.target.value) bulkMoveToPipeline(e.target.value) }}
                >
                  <option value="">Enviar para pipeline…</option>
                  {otherPipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <button onClick={bulkRemove} className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: '#EF4444' }}>Remover</button>
            </div>
            <button onClick={clearSelection} className="icon-btn" title="Limpar seleção" style={{ width: 20, height: 20 }}>
              <Icon name="close" size={12} />
            </button>
          </div>
        )}

        <div className="stagger kanban-board" style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0', minHeight: 'calc(100vh - 140px)' }}>
          {visibleStages.map(stage => {
            const stageLeads = getStageLeads(stage.id)
            const columnTotal = getColumnTotal(stage.id)
            return (
              <div key={stage.id} id={stage.id} className="kanban-column">
                <div className="kanban-col-header">
                  {stageLeads.length > 0 && (
                    <input
                      type="checkbox"
                      checked={stageLeads.length > 0 && stageLeads.every(l => selectedIds.has(l.id))}
                      onChange={() => selectColumn(stage.id)}
                      title="Selecionar toda a coluna"
                      style={{ width: 12, height: 12, cursor: 'pointer', accentColor: 'var(--gold)', flexShrink: 0 }}
                    />
                  )}
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{stage.name}</span>
                  <span className="kanban-col-count">{stageLeads.length}</span>
                </div>
                {columnTotal > 0 && (
                  <div className="kanban-col-total">
                    {(columnTotal / 1000).toFixed(0)}K€
                    {stage.probability < 100 && (
                      <span style={{ opacity: 0.6 }}> · {((columnTotal * stage.probability / 100) / 1000).toFixed(0)}K€ pond.</span>
                    )}
                  </div>
                )}
                <SortableContext items={stageLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn id={stage.id}>
                    {stageLeads.map(lead => (
                      <LeadCard
                        key={lead.id} lead={lead} isDragging={lead.id === activeId}
                        onOpenContact={onOpenContact} cardFields={cardFields}
                        onDuplicated={onDuplicated} onEditProperty={setEditingProperty}
                        onHoverStart={handleCardHoverStart} onHoverEnd={handleCardHoverEnd}
                        selected={selectedIds.has(lead.id)} onSelect={handleSelect}
                        onRemove={removeCard}
                      />
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
          personId={editingProperty.person_id}
          onClose={() => setEditingProperty(null)}
          onSelect={(property: ContactPropertyCandidate) => updateCardProperty({ property_id: property.id, zone: property.zone, typology: property.typology, budget: property.price })}
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
