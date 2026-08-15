import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import type { Listing, LeadPreference, MatchReason } from './types'

function tipologiaToNum(tipologia: string | null): number | null {
  if (!tipologia) return null
  const m = tipologia.match(/[tT]\s*(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

function precoOk(listing: Listing, pref: LeadPreference): boolean {
  if (pref.preco_max === null) return true
  if (listing.preco === null) return false
  return listing.preco <= pref.preco_max
}

function tipologiaOk(listing: Listing, pref: LeadPreference): boolean {
  if (!pref.tipologia_min) return true
  const minimo = tipologiaToNum(pref.tipologia_min)
  const atual = tipologiaToNum(listing.tipologia)
  if (minimo === null) return true
  if (atual === null) return false
  return atual >= minimo
}

function extrasOk(listing: Listing, pref: LeadPreference): boolean {
  if (!pref.extras.length) return true
  const presentes = new Set(listing.extras.map((e) => e.toLowerCase().trim()))
  return pref.extras.every((req) =>
    Array.from(presentes).some(
      (p) => p.includes(req.toLowerCase().trim()) || req.toLowerCase().trim().includes(p)
    )
  )
}

async function zonaOk(listing: Listing, pref: LeadPreference): Promise<boolean> {
  if (!pref.zonas.length) return true
  if (!listing.zona) return false

  const client = getAIClient()
  const response = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: 'user',
        content: `A localização de um imóvel é: "${listing.zona}".\nO comprador procura nestas zonas: ${JSON.stringify(pref.zonas)}.\n\nA localização do imóvel pertence (ou está contida) em alguma das zonas procuradas pelo comprador? Considera bairros, freguesias e localidades vizinhas dentro do mesmo concelho/zona. Responde APENAS com 'sim' ou 'não'.`,
      },
    ],
    max_tokens: 5,
  })

  const answer = (response.choices[0]?.message?.content ?? '').trim().toLowerCase()
  return answer.startsWith('sim') || answer.startsWith('s')
}

export async function evaluateMatch(
  listing: Listing,
  pref: LeadPreference
): Promise<MatchReason | null> {
  const pOk = precoOk(listing, pref)
  const tOk = tipologiaOk(listing, pref)
  const eOk = extrasOk(listing, pref)

  if (!(pOk && tOk && eOk)) return null

  const zOk = await zonaOk(listing, pref)
  if (!zOk) return null

  const partes: string[] = []
  if (pref.zonas.length) partes.push(`zona (${listing.zona} ⊂ ${pref.zonas.join(', ')})`)
  if (pref.tipologia_min) partes.push(`tipologia (${listing.tipologia} ≥ ${pref.tipologia_min})`)
  if (pref.preco_max !== null) partes.push(`preço (${listing.preco}€ ≤ ${pref.preco_max}€)`)
  if (pref.extras.length) partes.push(`extras (${pref.extras.join(', ')})`)

  return {
    zona_ok: zOk,
    tipologia_ok: tOk,
    preco_ok: pOk,
    extras_ok: eOk,
    explicacao: 'Match em: ' + partes.join('; '),
  }
}
