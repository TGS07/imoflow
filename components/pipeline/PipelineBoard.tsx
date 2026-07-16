'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { HelpButton } from '@/components/help/HelpButton'
import { Lead, PipelineStage, Pipeline } from '@/types'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'
import { NewLeadModal } from '@/components/leads/NewLeadModal'
import { ContactPickerModal } from '@/components/pipeline/ContactPickerModal'

export function PipelineBoard({ isAdmin }: { isAdmin: boolean }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewLead, setShowNewLead] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

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

  const tabBase = { height: 32, padding: '0 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'Jost, sans-serif', whiteSpace: 'nowrap' as const, border: '1px solid var(--border)' }

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

      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="font-display" style={{ fontSize: 20, marginRight: 4 }}>Pipeline <HelpButton section="pipeline" /></h1>
          {/* Seletor de pipelines */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pipelines.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                style={{
                  ...tabBase,
                  background: p.id === selectedId ? 'var(--gold-glow)' : 'var(--card)',
                  color: p.id === selectedId ? 'var(--gold)' : 'var(--muted)',
                  borderColor: p.id === selectedId ? 'var(--gold)' : 'var(--border)',
                  fontWeight: p.id === selectedId ? 600 : 400,
                }}
              >
                {p.name}
              </button>
            ))}
            {isAdmin && (
              <button onClick={createPipeline} title="Nova pipeline" style={{ ...tabBase, background: 'var(--card)', color: 'var(--muted)' }}>+ Pipeline</button>
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
          <KanbanBoard key={selectedId} initialLeads={leads} stages={stages} />
        )}
      </div>
    </>
  )
}
