'use client'
import { useState, useEffect, useCallback } from 'react'
import { Lead, PipelineStage, Pipeline, PipelineCardField } from '@/types'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'
import { NewLeadModal } from '@/components/leads/NewLeadModal'
import { PropertyPickerModal } from '@/components/pipeline/PropertyPickerModal'
import { ContactPickerModal } from '@/components/pipeline/ContactPickerModal'
import { ContactSlideOver } from '@/components/pipeline/ContactSlideOver'
import { PipelineSettingsModal } from '@/components/pipeline/PipelineSettingsModal'

export function PipelineBoard({ isAdmin }: { isAdmin: boolean }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewLead, setShowNewLead] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [openContact, setOpenContact] = useState<{ personId: string; leadId: string } | null>(null)
  const [pipelineModal, setPipelineModal] = useState<{ mode: 'create' } | { mode: 'edit'; pipeline: Pipeline } | null>(null)

  const loadPipelines = useCallback(async () => {
    const res = await fetch('/api/pipelines')
    const data: Pipeline[] = res.ok ? await res.json() : []
    setPipelines(data)
    setSelectedId(prev => prev && data.some(p => p.id === prev) ? prev : (data[0]?.id ?? null))
  }, [])

  useEffect(() => { loadPipelines() }, [loadPipelines])

  const loadBoard = useCallback(async (pipelineId: string) => {
    setLoading(true)
    const [s, l] = await Promise.all([
      fetch(`/api/pipeline-stages?pipeline_id=${pipelineId}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/leads?pipeline_id=${pipelineId}`).then(r => r.ok ? r.json() : []),
    ])
    setStages(s)
    setLeads(l)
    setLoading(false)
  }, [])

  useEffect(() => { if (selectedId) loadBoard(selectedId) }, [selectedId, loadBoard])

  const selected = pipelines.find(p => p.id === selectedId) ?? null

  const activeLeads = leads.filter(l => l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost)
  const pipelineValue = activeLeads.reduce((sum, l) => sum + (l.deal_value ?? 0), 0)

  function formatCompactEuro(value: number) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })}M€`
    if (value >= 1_000) return `${(value / 1_000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })}k€`
    return `${value.toLocaleString('pt-PT')}€`
  }

  const alreadyInIds = new Set(
    leads.filter(l => l.person_id && l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost)
      .map(l => l.person_id as string)
  )

  async function deletePipeline(p: Pipeline) {
    if (!confirm(`Eliminar a pipeline "${p.name}"? As etapas são apagadas.`)) return
    const res = await fetch(`/api/pipelines/${p.id}`, { method: 'DELETE' })
    if (res.ok) {
      setPipelines(prev => prev.filter(x => x.id !== p.id))
      if (selectedId === p.id) setSelectedId(null) // loadPipelines escolhe a 1ª
      loadPipelines()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Erro ao eliminar pipeline.')
    }
  }

  return (
    <>
      {showNewLead && selectedId && (
        <NewLeadModal defaultPipelineIds={[selectedId]} onClose={() => setShowNewLead(false)} onCreated={() => { setShowNewLead(false); if (selectedId) loadBoard(selectedId) }} />
      )}
      {showPicker && selected && (
        <PropertyPickerModal
          pipelineId={selected.id}
          pipelineName={selected.name}
          onClose={() => setShowPicker(false)}
          onAdded={() => selectedId && loadBoard(selectedId)}
        />
      )}
      {showContactPicker && selected && (
        <ContactPickerModal
          pipelineId={selected.id}
          pipelineName={selected.name}
          alreadyInIds={alreadyInIds}
          onClose={() => setShowContactPicker(false)}
          onAdded={() => selectedId && loadBoard(selectedId)}
        />
      )}
      {openContact && (
        <ContactSlideOver
          personId={openContact.personId}
          highlightLeadId={openContact.leadId}
          onClose={() => setOpenContact(null)}
          onChanged={() => selectedId && loadBoard(selectedId)}
        />
      )}
      {pipelineModal && (
        <PipelineSettingsModal
          pipeline={pipelineModal.mode === 'edit' ? pipelineModal.pipeline : null}
          onClose={() => setPipelineModal(null)}
          onSaved={p => {
            if (pipelineModal.mode === 'create') {
              setPipelines(prev => [...prev, p])
              setSelectedId(p.id)
            } else {
              setPipelines(prev => prev.map(x => x.id === p.id ? p : x))
            }
          }}
        />
      )}

      <div className="page-pad pipeline-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h1 className="font-display" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Pipeline</h1>
          {/* Seletor de pipelines */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {pipelines.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`pipeline-tab${p.id === selectedId ? ' active' : ''}`}
              >
                {p.name}
              </button>
            ))}
            {isAdmin && (
              <button onClick={() => setPipelineModal({ mode: 'create' })} title="Nova pipeline" className="pipeline-tab" style={{ color: 'var(--muted)' }}>+</button>
            )}
          </div>
          {isAdmin && selected && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={() => setPipelineModal({ mode: 'edit', pipeline: selected })} title="Editar pipeline" className="icon-btn-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              </button>
              <button onClick={() => deletePipeline(selected)} title="Eliminar pipeline" className="icon-btn-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          <button onClick={() => setShowPicker(true)} disabled={!selected} className="btn btn-ghost" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            + Imóvel
          </button>
          <button onClick={() => setShowContactPicker(true)} disabled={!selected} className="btn btn-ghost" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            + Contacto
          </button>
          <button onClick={() => setShowNewLead(true)} disabled={!selectedId} className="btn btn-primary" style={{ fontSize: 13, fontWeight: 600 }}>+ Lead</button>
        </div>
      </div>

      <div className="page-pad" style={{ padding: '24px 32px', flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>A carregar…</div>
        ) : stages.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Esta pipeline ainda não tem etapas.{isAdmin && <> Cria-as em <a href="/settings/pipeline" style={{ color: 'var(--gold)' }}>Definições → Pipeline</a>.</>}
          </div>
        ) : (
          <KanbanBoard
            key={selectedId}
            initialLeads={leads}
            stages={stages}
            pipelines={pipelines}
            currentPipelineId={selectedId}
            onOpenContact={(personId, leadId) => setOpenContact({ personId, leadId })}
            cardFields={{
              primary: selected?.card_primary_field ?? 'name',
              secondary: selected?.card_secondary_field ?? 'zone',
              all: selected?.card_fields ?? [selected?.card_primary_field ?? 'name', selected?.card_secondary_field ?? 'zone'],
            }}
            onDuplicated={() => selectedId && loadBoard(selectedId)}
            onCardUpdated={() => selectedId && loadBoard(selectedId)}
          />
        )}
      </div>
    </>
  )
}
