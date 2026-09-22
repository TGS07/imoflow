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

const DAYS_GREEN_MAX = 5
const DAYS_AMBER_MAX = 14

function daysPillColor(days: number): string {
  if (days <= DAYS_GREEN_MAX) return 'kanban-days-green'
  if (days <= DAYS_AMBER_MAX) return 'kanban-days-amber'
  return 'kanban-days-red'
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #9B7B3C, #C9A84C)',
  'linear-gradient(135deg, #6B8E6B, #8FBC8F)',
  'linear-gradient(135deg, #7B6BA0, #A08BCF)',
  'linear-gradient(135deg, #8B6B5B, #B8907E)',
  'linear-gradient(135deg, #5B7B9B, #7BAACF)',
  'linear-gradient(135deg, #9B5B6B, #CF8B9F)',
  'linear-gradient(135deg, #7B8B5B, #A0B87E)',
  'linear-gradient(135deg, #8B7B5B, #CFBA8B)',
]

function avatarGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

const CHIP_FIELDS = new Set<PipelineCardField>(['zone', 'typology', 'property_type', 'call_status', 'source'])
const CONTACT_FIELDS = new Set<PipelineCardField>(['phone', 'email'])
const PROPERTY_FIELDS = new Set<PipelineCardField>(['property', 'property_ref'])

function LeadCard({ lead, isDragging, onOpenContact, cardFields, onDuplicated, onEditProperty, onHoverStart, onHoverEnd, selected, onSelect, onRemove }: {
  lead: Lead; isDragging?: boolean; onOpenContact?: (personId: string, leadId: string) => void; cardFields: PipelineCardFields; onDuplicated?: () => void; onEditProperty?: (lead: Lead) => void; onHoverStart?: (lead: Lead) => void; onHoverEnd?: () => void
  selected?: boolean; onSelect?: (id: string, checked: boolean) => void; onRemove?: (id: string) => void
}) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const initials = (lead.people?.name ?? lead.name).split(' ').map((n: string) => n[0]).slice(0, 2).join('')

  const fields = cardFields.all
  const [notesExpanded, setNotesExpanded] = useState(false)
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

  const nameVal = lead.people?.name ?? lead.name
  const rawValue = lead.deal_value ?? lead.budget ?? 0
  const budgetVal = rawValue > 0
    ? rawValue >= 1_000_000 ? `${(rawValue / 1_000_000).toFixed(1)}M€` : `${(rawValue / 1_000).toFixed(0)}K€`
    : null
  const days = daysInStage(lead)

  const contactRows: { field: PipelineCardField; icon: string; value: string }[] = []
  const chipItems: { field: PipelineCardField; value: string }[] = []
  const propertyRows: { field: PipelineCardField; value: string }[] = []
  let notesVal: string | null = null
  let showValue = false

  for (const f of fields) {
    if (f === 'name') continue
    const val = cardFieldValue(lead, f)
    if (!val) continue

    if (CONTACT_FIELDS.has(f)) {
      contactRows.push({ field: f, icon: f === 'phone' ? '📞' : '✉️', value: val })
    } else if (CHIP_FIELDS.has(f)) {
      chipItems.push({ field: f, value: val })
    } else if (PROPERTY_FIELDS.has(f)) {
      propertyRows.push({ field: f, value: val })
    } else if (f === 'notes') {
      notesVal = val
    } else if (f === 'value') {
      showValue = true
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
        className={`kanban-card${selected ? ' kanban-card-selected' : ''}${isDragging ? ' kanban-card-dragging' : ''}`}
      >
        {/* Row 1: checkbox + avatar + name + type badge + actions */}
        <div className="kanban-card-top">
          {onSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={e => { e.stopPropagation(); onSelect(lead.id, e.target.checked) }}
              onClick={e => e.stopPropagation()}
              className="kanban-checkbox"
            />
          )}
          <div className="kanban-card-avatar" style={{ background: avatarGradient(nameVal) }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kanban-card-name" title={nameVal}>{nameVal}</div>
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

        {/* Row 2: contact info (phone, email) */}
        {contactRows.length > 0 && (
          <div className="kc-contact-rows">
            {contactRows.map(r => (
              <div key={r.field} className="kc-contact-row" title={r.value}>
                <span className="kc-contact-icon">{r.icon}</span>
                <span className="kc-contact-val">{r.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Row 3: chips (zone, typology, property_type, call_status, source) */}
        {chipItems.length > 0 && (
          <div className="kanban-card-badges">
            {chipItems.map(c => (
              <span key={c.field} className="kanban-card-badge" title={c.value}>{c.value}</span>
            ))}
          </div>
        )}

        {/* Row 4: property info */}
        {propertyRows.length > 0 && (
          <div className="kc-property-row">
            <Icon name="home" size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
            <span className="kc-property-val" title={propertyRows.map(r => r.value).join(' · ')}>
              {propertyRows.map(r => r.value).join(' · ')}
            </span>
          </div>
        )}

        {/* Row 5: notes */}
        {notesVal && (
          <div
            className={`kc-notes${notesExpanded ? ' kc-notes-expanded' : ''}`}
            onClick={e => { e.stopPropagation(); setNotesExpanded(o => !o) }}
            title={notesExpanded ? undefined : notesVal}
          >
            <span className="kc-notes-text">{notesVal}</span>
          </div>
        )}

        {/* Footer: value + days */}
        <div className={`kanban-card-footer${!budgetVal && !showValue ? ' kanban-card-footer-no-value' : ''}`}>
          {budgetVal && <span className="kanban-card-value">{budgetVal}</span>}
          <span title="Dias nesta fase" className={`kanban-days-pill ${daysPillColor(days)}`}>
            {days} dias
          </span>
        </div>
      </div>
    </div>
  )
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  return <div ref={setNodeRef} style={{ minHeight: 120 }}>{children}</div>
}

function DroppablePipelineTab({ pipeline }: { pipeline: Pipeline; isOver?: boolean }) {
  const { setNodeRef, isOver: dndIsOver } = useDroppable({ id: `pipeline-tab-${pipeline.id}` })
  return (
    <div
      ref={setNodeRef}
      className={`pipeline-drop-zone${dndIsOver ? ' pipeline-drop-zone-over' : ''}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pipeline-drop-icon">
        <path d="M16 3h5v5"/><path d="m21 3-9 9"/><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/>
      </svg>
      <span className="pipeline-drop-name">{pipeline.name}</span>
    </div>
  )
}

function BulkDropdown({ label, icon, items, onSelect }: {
  label: string; icon: React.ReactNode
  items: { id: string; name: string }[]
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} className="bulk-dropdown-trigger">
        {icon}
        <span>{label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="bulk-dropdown-menu">
          {items.map(it => (
            <button key={it.id} className="bulk-dropdown-item" onClick={() => { onSelect(it.id); setOpen(false) }}>
              {it.name}
            </button>
          ))}
        </div>
      )}
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
    hoverTimer.current = setTimeout(() => setHoveredLead(lead), 4000)
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
          <div className="pipeline-drop-bar">
            <span className="pipeline-drop-label">Mover para:</span>
            {otherPipelines.map(p => (
              <DroppablePipelineTab key={p.id} pipeline={p} />
            ))}
          </div>
        )}

        {/* Bulk action bar */}
        <div className={`kanban-bulk-bar${selectedIds.size > 0 ? ' kanban-bulk-bar-visible' : ''}`}>
          <div className="bulk-bar-count">
            <span className="bulk-bar-number">{selectedIds.size}</span>
            <span className="bulk-bar-label">selecionado{selectedIds.size > 1 ? 's' : ''}</span>
            <button onClick={clearSelection} className="bulk-bar-clear" title="Limpar seleção" aria-label="Limpar seleção">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div className="bulk-bar-actions">
            <BulkDropdown
              label="Mover para fase…"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>}
              items={visibleStages.map(s => ({ id: s.id, name: s.name }))}
              onSelect={bulkMoveToStage}
            />
            {otherPipelines.length > 0 && (
              <BulkDropdown
                label="Enviar para pipeline…"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"/><path d="m21 3-9 9"/><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/></svg>}
                items={otherPipelines.map(p => ({ id: p.id, name: p.name }))}
                onSelect={bulkMoveToPipeline}
              />
            )}
            <button onClick={bulkRemove} className="bulk-bar-remove" title="Remover selecionados">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              <span>Remover</span>
            </button>
          </div>
        </div>

        <div className={`stagger kanban-board${selectedIds.size > 0 ? ' kanban-has-selection' : ''}`} style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0', minHeight: 'calc(100vh - 140px)' }}>
          {visibleStages.map(stage => {
            const stageLeads = getStageLeads(stage.id)
            const columnTotal = getColumnTotal(stage.id)
            return (
              <div key={stage.id} id={stage.id} className="kanban-column">
                <div className="kanban-col-header">
                  {stageLeads.length > 0 && (
                    <input
                      type="checkbox"
                      checked={stageLeads.every(l => selectedIds.has(l.id))}
                      onChange={() => selectColumn(stage.id)}
                      title="Selecionar toda a coluna"
                      className="kanban-col-checkbox"
                    />
                  )}
                  <div className="kanban-col-dot" style={{ background: stage.color || 'var(--muted)' }} />
                  <span className="kanban-col-name">{stage.name}</span>
                  <span className="kanban-col-count">{stageLeads.length}</span>
                  {columnTotal > 0 && (
                    <span className="kanban-col-total">{columnTotal >= 1_000_000 ? `${(columnTotal / 1_000_000).toFixed(1)}M€` : `${(columnTotal / 1_000).toFixed(0)}K€`}</span>
                  )}
                </div>
                <SortableContext items={stageLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn id={stage.id}>
                    {stageLeads.length === 0 && (
                      <div className="kanban-col-empty">Sem negócios</div>
                    )}
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
