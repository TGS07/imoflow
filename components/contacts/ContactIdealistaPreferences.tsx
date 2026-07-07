'use client'
import { useState, useEffect } from 'react'

const EXTRAS_SUGERIDOS = ['vista mar', 'garagem', 'piscina', 'jardim', 'varanda', 'elevador', 'ar condicionado', 'lareira']
const TIPOLOGIAS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5+']

interface ContactPreference {
  id?: string
  person_id?: string
  zonas: string[]
  tipologia_min: string | null
  preco_max: number | null
  extras: string[]
  is_active: boolean
}

const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }

export function ContactIdealistaPreferences({ personId, defaultZone }: { personId: string; defaultZone?: string | null }) {
  const [pref, setPref] = useState<ContactPreference>({ zonas: [], tipologia_min: null, preco_max: null, extras: [], is_active: true })
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [zonaInput, setZonaInput] = useState('')

  useEffect(() => {
    fetch(`/api/contact-preferences/${personId}`)
      .then(r => r.json())
      .then(d => {
        if (d && !d.error) {
          setPref({ zonas: d.zonas ?? [], tipologia_min: d.tipologia_min ?? null, preco_max: d.preco_max ?? null, extras: d.extras ?? [], is_active: d.is_active ?? true })
        } else if (defaultZone) {
          // primeira vez: pré-preenche com a zona já registada no contacto
          setPref(p => ({ ...p, zonas: [defaultZone] }))
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [personId, defaultZone])

  async function save() {
    setSaving(true)
    await fetch(`/api/contact-preferences/${personId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pref) })
    setSaving(false)
  }

  function addZona() {
    const z = zonaInput.trim()
    if (z && !pref.zonas.includes(z)) setPref(p => ({ ...p, zonas: [...p.zonas, z] }))
    setZonaInput('')
  }

  function removeZona(z: string) { setPref(p => ({ ...p, zonas: p.zonas.filter(x => x !== z) })) }

  function toggleExtra(e: string) {
    setPref(p => ({ ...p, extras: p.extras.includes(e) ? p.extras.filter(x => x !== e) : [...p.extras, e] }))
  }

  if (!loaded) return null

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="font-display" style={{ fontSize: 14 }}>🏠 Preferências Idealista</div>
          <div
            onClick={() => setPref(p => ({ ...p, is_active: !p.is_active }))}
            style={{ width: 32, height: 18, borderRadius: 9, background: pref.is_active ? 'var(--gold)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', top: 2, left: pref.is_active ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </div>
          <span style={{ fontSize: 10, color: pref.is_active ? 'var(--gold)' : 'var(--muted)', fontWeight: 500 }}>{pref.is_active ? 'Ativo' : 'Inativo'}</span>
        </div>
        <button onClick={save} disabled={saving} className="btn btn-primary btn-sm" style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? 'A guardar...' : 'Guardar'}
        </button>
      </div>

      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div className="label" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Zonas</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {pref.zonas.map(z => (
              <span key={z} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, background: 'rgba(176,125,46,0.10)', color: 'var(--gold)', border: '1px solid rgba(176,125,46,0.2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                {z}
                <span onClick={() => removeZona(z)} style={{ cursor: 'pointer', opacity: 0.6, fontSize: 13, lineHeight: 1 }}>×</span>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={zonaInput}
              onChange={e => setZonaInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addZona() } }}
              placeholder="Ex: Cascais, Parede..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addZona} className="btn btn-ghost btn-sm">+ Zona</button>
          </div>
        </div>

        <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div className="label" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Tipologia mínima</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {TIPOLOGIAS.map(t => (
                <button
                  key={t}
                  onClick={() => setPref(p => ({ ...p, tipologia_min: p.tipologia_min === t ? null : t }))}
                  style={{ fontSize: 11, padding: '5px 10px', borderRadius: 5, border: `1px solid ${pref.tipologia_min === t ? 'var(--gold)' : 'var(--border)'}`, background: pref.tipologia_min === t ? 'rgba(176,125,46,0.10)' : 'transparent', color: pref.tipologia_min === t ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif', fontWeight: pref.tipologia_min === t ? 600 : 400, transition: 'all 0.15s ease' }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Preço máximo (€)</div>
            <input
              type="number"
              value={pref.preco_max ?? ''}
              onChange={e => setPref(p => ({ ...p, preco_max: e.target.value ? Number(e.target.value) : null }))}
              placeholder="Ex: 400000"
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
        </div>

        <div>
          <div className="label" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Extras</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EXTRAS_SUGERIDOS.map(e => (
              <button
                key={e}
                onClick={() => toggleExtra(e)}
                style={{ fontSize: 11, padding: '5px 10px', borderRadius: 5, border: `1px solid ${pref.extras.includes(e) ? 'var(--gold)' : 'var(--border)'}`, background: pref.extras.includes(e) ? 'rgba(176,125,46,0.10)' : 'transparent', color: pref.extras.includes(e) ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif', transition: 'all 0.15s ease' }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
