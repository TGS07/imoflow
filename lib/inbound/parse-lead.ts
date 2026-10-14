// Interpreta o corpo enviado por um parceiro para /api/inbound/leads.
// Cada ferramenta (Make, Zapier, n8n, formulários do Meta, sites…) usa nomes
// de campos diferentes — aceitamos os mais comuns em PT e EN, e tudo o que
// não reconhecemos vai para as notas da lead para não se perder nada.

export type InboundLead = {
  name: string | null
  phone: string | null
  email: string | null
  message: string | null
  source: string | null
  campaign: string | null
  zone: string | null
  typology: string | null
  budget: number | null
  extras: [string, string][]
}

const ALIASES: Record<Exclude<keyof InboundLead, 'extras' | 'budget'> | 'budget' | 'first_name' | 'last_name', string[]> = {
  name: ['name', 'nome', 'full_name', 'fullname', 'nome_completo', 'cliente', 'contact_name'],
  first_name: ['first_name', 'firstname', 'primeiro_nome'],
  last_name: ['last_name', 'lastname', 'apelido', 'ultimo_nome'],
  phone: ['phone', 'telefone', 'telemovel', 'phone_number', 'tel', 'mobile', 'celular', 'whatsapp', 'contacto', 'numero'],
  email: ['email', 'e_mail', 'mail', 'email_address'],
  message: ['message', 'mensagem', 'notes', 'notas', 'nota', 'comment', 'comments', 'comentario', 'observacoes', 'descricao', 'description'],
  source: ['source', 'origem', 'fonte', 'platform', 'plataforma', 'canal', 'channel', 'utm_source'],
  campaign: ['campaign', 'campanha', 'utm_campaign', 'form_name', 'formulario', 'ad_name', 'anuncio'],
  zone: ['zone', 'zona', 'localizacao', 'location', 'cidade', 'city', 'concelho'],
  typology: ['typology', 'tipologia'],
  budget: ['budget', 'orcamento', 'preco', 'price', 'valor', 'max_price'],
}

// "Nome Completo" / "e-mail" / "Telemóvel" → nome_completo / e_mail / telemovel
export function normalizeKey(key: string): string {
  return key
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function toText(v: unknown, max: number): string | null {
  if (v == null) return null
  if (Array.isArray(v)) v = v.join(', ')
  if (typeof v === 'object') return null
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}

// Formulários do Meta/Zapier às vezes mandam [{ name: 'email', values: ['x'] }]
// ou { field_data: [...] } — achatamos para chave → valor.
function flatten(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const list = Array.isArray(body.field_data) ? body.field_data : Array.isArray(body.fields) ? body.fields : null
  if (list) {
    for (const item of list as Record<string, unknown>[]) {
      const key = typeof item?.name === 'string' ? item.name : typeof item?.key === 'string' ? item.key : null
      if (!key) continue
      out[key] = Array.isArray(item.values) ? item.values[0] : item.value ?? item.values
    }
  }
  for (const [k, v] of Object.entries(body)) {
    if (k === 'field_data' || k === 'fields') continue
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      // Um nível de aninhamento: { contact: { name, phone } }
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) if (!(k2 in out)) out[k2] = v2
    } else if (!(k in out)) {
      out[k] = v
    }
  }
  return out
}

export function parseInboundLead(raw: Record<string, unknown>): InboundLead {
  const flat = flatten(raw)
  const byKey = new Map<string, unknown>()
  for (const [k, v] of Object.entries(flat)) byKey.set(normalizeKey(k), v)

  const used = new Set<string>()
  function pick(field: keyof typeof ALIASES, max = 500): string | null {
    for (const alias of ALIASES[field]) {
      if (!byKey.has(alias)) continue
      const v = toText(byKey.get(alias), max)
      used.add(alias)
      if (v) return v
    }
    return null
  }

  let name = pick('name', 200)
  const first = pick('first_name', 100)
  const last = pick('last_name', 100)
  if (!name && (first || last)) name = [first, last].filter(Boolean).join(' ')

  const budgetText = pick('budget', 50)
  const budgetNum = budgetText ? Number(budgetText.replace(/[^\d.,]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) : NaN

  const lead: InboundLead = {
    name,
    phone: pick('phone', 50),
    email: pick('email', 200)?.toLowerCase() ?? null,
    message: pick('message', 3000),
    source: pick('source', 100),
    campaign: pick('campaign', 200),
    zone: pick('zone', 200),
    typology: pick('typology', 20),
    budget: Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : null,
    extras: [],
  }

  // Ruído técnico que não interessa ao consultor
  const IGNORE = new Set(['key', 'api_key', 'token', 'secret', 'id', 'lead_id', 'created_time', 'timestamp', 'form_id', 'page_id', 'adgroup_id', 'ad_id', 'campaign_id'])
  for (const [k, v] of byKey) {
    if (used.has(k) || IGNORE.has(k)) continue
    const text = toText(v, 300)
    if (text && lead.extras.length < 15) lead.extras.push([k.replace(/_/g, ' '), text])
  }
  return lead
}

// Origem livre → valores conhecidos do CRM (o texto original fica nas notas)
export function mapLeadSource(source: string | null): string {
  const s = normalizeKey(source ?? '')
  if (!s) return 'outro'
  if (/(^|_)(ig|insta|instagram)/.test(s)) return 'instagram'
  if (/(^|_)(fb|facebook|meta)/.test(s)) return 'facebook'
  if (/(site|web|landing|google|formulario|form)/.test(s)) return 'site'
  if (/(refer|indica)/.test(s)) return 'referencia'
  return 'outro'
}

export function buildLeadNotes(lead: InboundLead, connectionName: string): string {
  const lines: string[] = []
  if (lead.message) lines.push(lead.message)
  const meta: string[] = [`Via ${connectionName}`]
  if (lead.source) meta.push(`origem: ${lead.source}`)
  if (lead.campaign) meta.push(`campanha: ${lead.campaign}`)
  lines.push(`(${meta.join(' · ')})`)
  for (const [k, v] of lead.extras) lines.push(`${k}: ${v}`)
  return lines.join('\n').slice(0, 4000)
}
