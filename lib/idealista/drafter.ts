import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import type { Listing, LeadPreference } from './types'

const SYSTEM_PROMPT = `És um agente imobiliário português a escrever a um cliente comprador por WhatsApp.

Escreves uma mensagem curta, calorosa e natural (NÃO um anúncio, NÃO marketing agressivo), a avisar o cliente de que apareceu um imóvel que encaixa no que ele procura. Tom profissional mas próximo, como quem conhece o cliente.

Regras:
- Português de Portugal.
- 3 a 5 frases no máximo.
- Trata o cliente pelo primeiro nome.
- Refere os pontos concretos que interessam (tipologia, zona, preço, algum extra relevante).
- Inclui o link do anúncio.
- Termina com uma pergunta simples (ex: se quer agendar uma visita).
- Assina apenas com o primeiro nome do agente.
- NÃO inventes características que não estejam nos dados.
- Devolve só o texto da mensagem, sem assunto nem cabeçalhos.`

export async function draftMessage(
  listing: Listing,
  pref: LeadPreference,
  agentName: string
): Promise<string> {
  const client = getAIClient()
  const detalhes = [
    `Cliente: ${pref.lead_name}`,
    `Agente: ${agentName}`,
    `Imóvel: ${listing.titulo}`,
    `Tipologia: ${listing.tipologia}`,
    `Zona: ${listing.zona}`,
    `Preço: ${listing.preco}€`,
    `Área: ${listing.m2} m²`,
    `Extras: ${listing.extras.length ? listing.extras.join(', ') : '—'}`,
    `Link: ${listing.link}`,
  ].join('\n')

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Escreve a mensagem.\n\n${detalhes}` },
    ],
    max_tokens: 400,
  })

  return (response.choices[0]?.message?.content ?? '').trim()
}
