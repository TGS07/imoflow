import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import type { Listing, ParsedEmail } from './types'

const SYSTEM_PROMPT = `És um extrator de dados de emails de alerta do portal imobiliário Idealista.

Recebes o texto de um email (pode vir reencaminhado, com cabeçalhos e rodapés).
A tua tarefa é encontrar TODOS os imóveis anunciados e devolver os dados de cada um.

Devolve EXCLUSIVAMENTE JSON válido, sem texto à volta, com esta forma:
{
  "listings": [
    {
      "titulo": "string ou null",
      "zona": "string ou null (a localização do imóvel: zona/freguesia/rua)",
      "tipologia": "string ou null (ex: T0, T1, T2, T3...)",
      "preco": número inteiro em euros ou null (ex: 370000, não '370.000 €'),
      "m2": número inteiro ou null,
      "extras": ["lista", "de", "caracteristicas"] (ex: garagem, varanda, vista mar, elevador, condomínio; [] se nenhum),
      "link": "url do anúncio (idealista.pt/imovel/...) sem parâmetros utm, ou null"
    }
  ]
}

Regras:
- Se um campo não estiver no email, usa null (ou [] para extras). NUNCA inventes.
- No link, remove tudo a partir de '?' (os parâmetros de tracking utm).
- Ignora banners, rodapés, links de "ver todos os anúncios", apps e descontos.
- Se o email não tiver nenhum imóvel, devolve {"listings": []}.`

function stripHtmlToText(html: string): string {
  let text = html
  text = text.replace(/<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 [$1]')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  return text
}

function extractTextFromRawEmail(raw: string): string {
  const htmlMatch = raw.match(/Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\Z)/i)
  if (htmlMatch) {
    return stripHtmlToText(htmlMatch[1])
  }
  return stripHtmlToText(raw)
}

export async function parseEmail(rawEmail: string): Promise<ParsedEmail> {
  const text = extractTextFromRawEmail(rawEmail)
  const client = getAIClient()

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Extrai os imóveis deste email:\n\n${text}` },
    ],
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content ?? '{"listings":[]}'
  let json: string = content.trim()
  if (json.startsWith('```')) {
    json = json.split('```')[1]
    if (json.startsWith('json')) json = json.slice(4)
    json = json.trim()
  }

  const data = JSON.parse(json)
  const listings: Listing[] = (data.listings ?? []).map((item: Record<string, unknown>) => ({
    titulo: (item.titulo as string) ?? null,
    zona: (item.zona as string) ?? null,
    tipologia: (item.tipologia as string) ?? null,
    preco: typeof item.preco === 'number' ? item.preco : null,
    m2: typeof item.m2 === 'number' ? item.m2 : null,
    extras: Array.isArray(item.extras) ? item.extras : [],
    link: item.link ? String(item.link).split('?')[0] : null,
  }))

  return { listings }
}
