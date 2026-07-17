'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { HelpButton } from '@/components/help/HelpButton'
import { Lead, PipelineStage, Pipeline } from '@/types'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'
import { NewLeadModal } from '@/components/leads/NewLeadModal'
import { ContactPickerModal } from '@/components/pipeline/ContactPickerModal'
import { ContactSlideOver } from '@/components/pipeline/ContactSlideOver'

export function PipelineBoard({ isAdmin }: { isAdmin: boolean }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewLead, setShowNewLead] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [openContact, setOpenContact] = useState<{ personId: string; leadId: string } | null>(null)

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

  // Contactos já presentes nesta pipeline (lead ativa = etapa não won/lost)
  const alreadyInIds = useMemo(() => {
    const set = new Set<string>()
    for (const l of leads) {
      const st = l.pipeline_stages
      if (l.person_id && st && !st.is_won && !st.is_lost) set.add(l.person_id)
    }
    return set
  }, [leads])

  async function createPipeline() {
    const name = prompt('Nome da nova pipeline:')
    if (!name || !name.trim()) return
    const res = await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (res.ok) {
      const p: Pipeline = await res.json()
      setPipelines(prev => [...prev, p])
      setSelectedId(p.id)
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Erro ao criar pipeline.')
    }
  }

  async function renamePipeline(p: Pipeline) {
    const name = prompt('Novo nome da pipeline:', p.name)
    if (!name || !name.trim() || name.trim() === p.name) return
    const res = await fetch(`/api/pipelines/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (res.ok) {
      const updated: Pipeline = await res.json()
      setPipelines(prev => prev.map(x => x.id === p.id ? updated : x))
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Erro ao renomear pipeline.')
    }
  }

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
        <NewLeadModal pipelineId={selectedId} onClose={() => setShowNewLead(false)} onCreated={() => { setShowNewLead(false); if (selectedId) loadBoard(selectedId) }} />
      )}
      {showPicker && selected && (
        <ContactPickerModal
          pipelineId={selected.id}
          pipelineName={selected.name}
          alreadyInIds={alreadyInIds}
          onClose={() => setShowPicker(false)}
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

      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="font-display" style={{ fontSize: 20, marginRight: 4 }}>Pipeline <HelpButton section="pipeline" /></h1>
          {/* Seletor de pipelines */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pipelines.map(p => (
              <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button
                  onClick={() => setSelectedId(p.id)}
                  className={`chip${p.id === selectedId ? ' active' : ''}`}
                  style={isAdmin && p.id === selectedId ? { ...tabBase, borderTopRightRadius: 0, borderBottomRightRadius: 0 } : tabBase}
                >
                  {p.name}
                </button>
                {isAdmin && p.id === selectedId && (
                  <>
                    <button onClick={() => renamePipeline(p)} title="Renomear pipeline" className="chip active" style={{ ...tabBase, padding: '0 8px', borderRadius: 0, borderLeft: 'none' }}>✏️</button>
                    <button onClick={() => deletePipeline(p)} title="Eliminar pipeline" className="chip active" style={{ ...tabBase, padding: '0 8px', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 'none' }}>🗑️</button>
                  </>
                )}
              </span>
            ))}
            {isAdmin && (
              <button onClick={createPipeline} title="Nova pipeline" className="chip" style={tabBase}>+ Pipeline</button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setShowPicker(true)} disabled={!selected} className="btn btn-ghost">+ Contactos</button>
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
          <KanbanBoard key={selectedId} initialLeads={leads} stages={stages} onOpenContact={(personId, leadId) => setOpenContact({ personId, leadId })} />
        )}
      </div>
    </>
  )
}
