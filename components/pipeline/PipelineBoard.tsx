'use client'
import { useState, useEffect, useCallback } from 'react'
import { HelpButton } from '@/components/help/HelpButton'
import { Lead, PipelineStage, Pipeline } from '@/types'
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

  const tabBase = { height: 32, padding: '0 14px', borderRadius: 8 }

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

      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ marginRight: 4 }}>
            <h1 className="font-display" style={{ fontSize: 20 }}>Pipeline <HelpButton section="pipeline" /></h1>
            {!loading && selected && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {activeLeads.length} lead{activeLeads.length === 1 ? '' : 's'} ativo{activeLeads.length === 1 ? '' : 's'}
                {pipelineValue > 0 && <> · {formatCompactEuro(pipelineValue)} em pipeline</>}
              </div>
            )}
          </div>
          {/* Seletor de pipelines */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pipelines.map(p => (
              <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button
                  onClick={() => setSelectedId(p.id)}
                  className={`chip${p.id === selectedId ? ' active' : ''}`}
                  style={tabBase}
                >
                  {p.name}
                </button>
                {isAdmin && p.id === selectedId && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
                    <button onClick={() => setPipelineModal({ mode: 'edit', pipeline: p })} title="Editar pipeline" className="icon-btn-sm">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button onClick={() => deletePipeline(p)} title="Eliminar pipeline" className="icon-btn-sm">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </span>
                )}
              </span>
            ))}
            {isAdmin && (
              <button onClick={() => setPipelineModal({ mode: 'create' })} title="Nova pipeline" className="chip" style={tabBase}>+ Pipeline</button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setShowContactPicker(true)} disabled={!selected} className="btn btn-ghost">+ Contactos</button>
          <button onClick={() => setShowPicker(true)} disabled={!selected} className="btn btn-ghost">+ Imóveis</button>
          <button onClick={() => setShowNewLead(true)} disabled={!selectedId} className="btn btn-primary">+ Novo Lead</button>
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
            onOpenContact={(personId, leadId) => setOpenContact({ personId, leadId })}
            cardFields={{ primary: selected?.card_primary_field ?? 'name', secondary: selected?.card_secondary_field ?? 'zone' }}
            onDuplicated={() => selectedId && loadBoard(selectedId)}
            onCardUpdated={() => selectedId && loadBoard(selectedId)}
          />
        )}
      </div>
    </>
  )
}
