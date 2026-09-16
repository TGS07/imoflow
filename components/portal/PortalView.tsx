'use client'
import type { PortalData } from '@/lib/portal/get-portal-data'
import { PortalPropertyCard } from './PortalPropertyCard'

async function postAction(token: string, action: 'favorite' | 'request_visit', propertyId: string) {
  await fetch(`/api/portal/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, property_id: propertyId }),
  })
}

export function PortalView({ data, token }: { data: PortalData; token: string }) {
  const { agency, agent, progress, properties } = data

  async function handleFavorite(propertyId: string) {
    await postAction(token, 'favorite', propertyId)
  }

  async function handleRequestVisit(propertyId: string) {
    await postAction(token, 'request_visit', propertyId)
  }

  return (
    <div style={{ width: '100%', maxWidth: 960 }}>
      {/* Marca da agência */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
        {agency.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agency.logo_url} alt={agency.name} style={{ height: 44, maxWidth: 200, objectFit: 'contain' }} />
        ) : (
          <div className="font-display" style={{ fontSize: 24, color: 'var(--gold)' }}>{agency.name}</div>
        )}
      </div>

      {/* Saudação + progresso no funil */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h1 className="font-display" style={{ fontSize: 22, marginBottom: 6 }}>Olá, {data.lead_name}</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: progress ? 20 : 0 }}>
          Aqui tem os imóveis recomendados para si e o ponto de situação do seu processo.
        </p>

        {progress && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: progress.is_won ? 'var(--green)' : progress.is_lost ? 'var(--red)' : 'var(--gold)' }}>
                {progress.stage_name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Etapa {progress.position + 1} de {progress.total}
              </span>
            </div>
            <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'var(--bg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, ((progress.position + 1) / progress.total) * 100)}%`,
                  height: '100%',
                  background: progress.is_won ? 'var(--green)' : progress.is_lost ? 'var(--red)' : 'var(--gold-gradient)',
                  transition: 'width 0.3s var(--ease)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Contactar agente */}
      {agent && (
        <div className="card" style={{ padding: 18, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>O seu agente</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{agent.name}</div>
          </div>
          <a href={`mailto:${agent.email}`} className="btn btn-primary btn-sm" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Contactar agente
          </a>
        </div>
      )}

      {/* Imóveis recomendados */}
      <div style={{ marginBottom: 12 }}>
        <h2 className="font-display" style={{ fontSize: 16 }}>Imóveis recomendados para si</h2>
      </div>

      {properties.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Ainda não há imóveis recomendados. Volte a visitar esta página em breve.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {properties.map(p => (
            <PortalPropertyCard key={p.id} property={p} onFavorite={handleFavorite} onRequestVisit={handleRequestVisit} />
          ))}
        </div>
      )}
    </div>
  )
}
