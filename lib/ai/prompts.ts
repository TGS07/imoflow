import type { Lead, Activity, Person, ContactInteraction } from '@/types'

export function buildSuggestActionPrompt(lead: Lead, activities: Activity[]): string {
  const lastActivity = activities[0]
  const daysSinceLast = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity.created_at).getTime()) / 86_400_000)
    : null
  const stageName = (lead.pipeline_stages as { name?: string } | null)?.name ?? 'desconhecida'

  const history = activities
    .slice(0, 10)
    .map(a => `- [${new Date(a.created_at).toLocaleDateString('pt-PT')}] ${a.type}: ${a.title}${a.description ? ` — ${a.description}` : ''}`)
    .join('\n')

  return `És um assistente de vendas imobiliárias. Analisa o seguinte lead e sugere a próxima ação mais importante.

LEAD:
- Nome: ${lead.name}
- Etapa do pipeline: ${stageName}
- Orçamento: ${lead.budget ? `${lead.budget}€` : 'não definido'}
- Zona: ${lead.zone ?? 'não definida'}
- Tipologia: ${lead.typology ?? 'não definida'}
- Notas: ${lead.notes ?? 'nenhuma'}
- Criado em: ${new Date(lead.created_at).toLocaleDateString('pt-PT')}
${daysSinceLast !== null ? `- Dias desde última atividade: ${daysSinceLast}` : '- Sem atividades anteriores'}

HISTORIAL RECENTE:
${history || 'Sem atividades registadas.'}

Responde em JSON com exatamente este formato (sem markdown, sem texto extra):
{"action": "descrição curta da ação (máx 80 chars)", "reason": "justificação curta (máx 120 chars)", "urgency": "alta|media|baixa"}`
}

export function buildQualifyLeadPrompt(lead: Partial<Lead>): string {
  return `És um consultor imobiliário experiente. Avalia a qualidade deste lead numa escala de 1 a 5.

DADOS DO LEAD:
- Nome: ${lead.name}
- Fonte: ${lead.source ?? 'desconhecida'}
- Orçamento: ${lead.budget ? `${lead.budget}€` : 'não definido'}
- Zona: ${lead.zone ?? 'não definida'}
- Tipologia: ${lead.typology ?? 'não definida'}
- Notas: ${lead.notes ?? 'nenhuma'}

ESCALA:
1 = Muito frio (sem budget ou informação)
2 = Frio (informação vaga)
3 = Morno (algum potencial)
4 = Quente (budget definido, zona clara)
5 = Muito quente (budget, zona, urgência claros)

Responde em JSON (sem markdown, sem texto extra):
{"score": 1, "reason": "justificação em 1 frase (máx 100 chars)"}`
}

export function buildDraftWhatsAppPrompt(
  lead: Lead,
  activities: Activity[],
  agentName: string,
  agencyName: string,
): string {
  const stageName = (lead.pipeline_stages as { name?: string } | null)?.name ?? 'em análise'
  const lastActivity = activities[0]

  const history = activities
    .slice(0, 5)
    .map(a => `- ${a.type}: ${a.title}`)
    .join('\n')

  return `És ${agentName} da agência ${agencyName}. Escreve uma mensagem WhatsApp personalizada para o cliente ${lead.name}.

CONTEXTO DO CLIENTE:
- Etapa: ${stageName}
- Orçamento: ${lead.budget ? `${lead.budget}€` : 'não definido'}
- Zona de interesse: ${lead.zone ?? 'não definida'}
- Tipologia: ${lead.typology ?? 'não definida'}
- Último contacto: ${lastActivity ? `${lastActivity.type} — ${lastActivity.title}` : 'primeiro contacto'}

HISTORIAL:
${history || 'Sem contactos anteriores.'}

REGRAS:
- Tom profissional mas caloroso, tuteamento
- Máximo 3 frases
- Sem emojis em excesso (máx 1)
- Em português de Portugal
- Não inventes imóveis específicos
- Termina com convite para responder ou marcar visita

Responde apenas com o texto da mensagem, sem aspas nem formatação.`
}

export function buildClosingEmailPrompt(params: {
  propertyTitle: string
  contactNames: string[]
  agentName: string
  agencyName: string
  reviewLink: string
}): string {
  const { propertyTitle, contactNames, agentName, agencyName, reviewLink } = params
  return [
    `Escreve um email caloroso e profissional em português de Portugal.`,
    `Contexto: acabámos de fechar a venda do imóvel "${propertyTitle}".`,
    `Destinatários envolvidos no negócio: ${contactNames.join(', ')}.`,
    `Objetivos do email:`,
    `1) Agradecer e parabenizar todos os envolvidos pelo negócio concluído.`,
    `2) Pedir gentilmente uma avaliação (Google review) com este link: ${reviewLink}`,
    `Assina como ${agentName}, da agência ${agencyName}.`,
    `Devolve APENAS o corpo do email (sem assunto, sem markdown).`,
  ].join('\n')
}

// Instrução partilhada por todos os prompts de extração por voz: tudo o que
// for dito e não couber num campo estruturado (nomes de familiares, profissão,
// motivo da venda/compra, para onde quer ir, preferências como luz natural ou
// vista, timing/urgência, etc.) deve ficar resumido em "notes", em vez de
// ser perdido. Só isto justifica ter um campo de notas em todas as entidades.
const NOTES_FIELD_INSTRUCTION = `"notes": string|null — qualquer informação adicional relevante que não tenha campo próprio no esquema (ex: nomes de familiares/cônjuge, profissão, motivo da venda ou compra, para onde a pessoa quer ir, preferências como luz natural, vista, arrumação, timing ou urgência, contexto pessoal relevante). Resume em frases curtas e factuais, em português de Portugal. Usa null se não houver nada relevante além dos outros campos. Nunca inventes informação que não foi dita.`

function buildContactExtractionPrompt(transcript: string): string {
  return [
    `Extrai dados de contacto imobiliário a partir desta transcrição (português).`,
    `Transcrição: """${transcript}"""`,
    `Devolve APENAS JSON válido com este formato (sem texto extra):`,
    `{"name": string, "phone": string|null, "email": string|null,`,
    ` "birthday": string|null (data de nascimento no formato "YYYY-MM-DD", só se for dita),`,
    ` "is_regular": boolean|null (true só se o agente disser explicitamente que é um contacto a acompanhar/contactar regularmente),`,
    ` "types": array de ("comprador"|"vendedor"|"investidor"|"consultor"|"servico"),`,
    ` "financial_capacity": ("muito_baixo"|"baixo"|"medio"|"medio_alto"|"alto"|"altissimo")|null,`,
    ` "details": {"looking_for"?: string, "search_zone"?: string,`,
    `  "selling_property"?: string, "selling_zone"?: string, "selling_price"?: number, "typology"?: string,`,
    `  "has_garage"?: boolean, "has_balcony"?: boolean, "has_exclusivity"?: boolean, "is_active_seller"?: boolean,`,
    `  "agency_name"?: string, "working_zone"?: string, "service_type"?: string},`,
    ` ${NOTES_FIELD_INSTRUCTION}}`,
    `Nota: "consultor" é um consultor imobiliário de outra agência ("agency_name" é a agência dele). "servico" é um prestador de serviços ("service_type" é o que faz, ex: canalizador). "working_zone" é a zona onde o consultor ou prestador atua.`,
    `Se um campo não for mencionado, omite-o (ou usa null para name/phone/email/birthday/is_regular). Bandas: <250k muito_baixo; 250-500k baixo; 500k-1M medio; 1-2.5M medio_alto; 2.5-5M alto; 5M+ altissimo.`,
  ].join('\n')
}

function buildInteractionExtractionPrompt(transcript: string): string {
  return [
    `Um agente imobiliário gravou uma nota de voz sobre uma interação com um contacto.`,
    `Transcrição: """${transcript}"""`,
    `Devolve APENAS JSON válido (sem texto extra) com este formato:`,
    `{"type": "chamada"|"visita"|"email"|"whatsapp"|"nota", "note": string}`,
    `Regras: "type" é o tipo de interação descrita (na dúvida usa "nota").`,
    `"note" é um resumo claro e conciso em português de Portugal (1-3 frases),`,
    `escrito na primeira pessoa do agente, com os factos importantes (preços, datas, decisões).`,
  ].join('\n')
}

export type ContactAiContext = {
  leads: { pipeline: string; stage: string; daysInStage: number; value: number | null }[]
  properties: { label: string; role: string; status: string; visit_activity: string | null }[]
}

const OUTCOME_TEXT: Record<string, string> = {
  atendeu: 'atendeu', nao_atendeu: 'NÃO atendeu', whatsapp: 'não atendeu, enviada mensagem WhatsApp',
  enviado: 'enviado', respondido: 'respondeu',
}

export function buildSuggestContactActionPrompt(
  person: Person,
  interactions: ContactInteraction[],
  ctx: ContactAiContext = { leads: [], properties: [] },
): string {
  const lastInteraction = interactions[0]
  const daysSinceLast = lastInteraction
    ? Math.floor((Date.now() - new Date(lastInteraction.created_at).getTime()) / 86_400_000)
    : null

  const typeLabels: Record<string, string> = { comprador: 'Comprador', vendedor: 'Vendedor', investidor: 'Investidor', consultor: 'Consultor Imobiliário', servico: 'Serviço' }
  const types = (person.types ?? []).map(t => typeLabels[t] ?? t).join(', ') || 'não definido'
  const d = person.details ?? {}
  const today = new Date()
  const weekday = today.toLocaleDateString('pt-PT', { weekday: 'long' })

  const detailLines: string[] = []
  if (person.types?.includes('comprador') || person.types?.includes('investidor')) {
    detailLines.push(`- O que procura: ${d.looking_for ?? 'não definido'}`)
    detailLines.push(`- Zona de procura: ${d.search_zone ?? 'não definida'}`)
    if (d.looking_price) detailLines.push(`- Preço máximo: ${d.looking_price}€`)
    detailLines.push(`- Já comprou connosco: ${d.already_bought ? 'sim' : 'não'}`)
  }
  if (person.types?.includes('vendedor') || person.types?.includes('investidor')) {
    detailLines.push(`- O que vende: ${d.selling_property ?? 'não definido'}`)
    detailLines.push(`- Zona de venda: ${d.selling_zone ?? 'não definida'}`)
    detailLines.push(`- Preço pedido: ${d.selling_price ? `${d.selling_price}€` : 'não definido'}`)
    detailLines.push(`- Vendedor ativo: ${d.is_active_seller ? 'sim' : 'não'}`)
    detailLines.push(`- Exclusividade: ${d.has_exclusivity ? 'sim' : 'não'}`)
  }
  if (person.types?.includes('consultor')) {
    detailLines.push(`- Agência: ${d.agency_name ?? 'não definida'}`)
    detailLines.push(`- Zona de atuação: ${d.working_zone ?? 'não definida'}`)
  }
  if (person.types?.includes('servico')) {
    detailLines.push(`- Tipo de serviço: ${d.service_type ?? 'não definido'}`)
    detailLines.push(`- Zona de atuação: ${d.working_zone ?? 'não definida'}`)
  }

  const nextCall = person.next_call_at
    ? `- Próxima chamada agendada: ${new Date(person.next_call_at + 'T00:00').toLocaleDateString('pt-PT')}`
    : '- Sem próxima chamada agendada'

  // Padrões úteis: tentativas falhadas seguidas, taxa de atendimento
  const calls = interactions.filter(i => i.type === 'chamada')
  const answered = calls.filter(i => i.outcome === 'atendeu').length
  let missedStreak = 0
  for (const c of calls) { if (c.outcome === 'nao_atendeu' || c.outcome === 'whatsapp') missedStreak++; else break }

  const history = interactions
    .slice(0, 15)
    .map(i => {
      const dt = new Date(i.created_at)
      const when = `${dt.toLocaleDateString('pt-PT')} ${dt.toLocaleDateString('pt-PT', { weekday: 'short' })} ${dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`
      return `- [${when}] ${i.type}${i.outcome ? ` (${OUTCOME_TEXT[i.outcome] ?? i.outcome})` : ''}${i.note ? ` — ${i.note}` : ''}`
    })
    .join('\n')

  const leadsText = ctx.leads.length
    ? ctx.leads.map(l => `- Pipeline «${l.pipeline}», fase «${l.stage}» há ${l.daysInStage} dias${l.value ? `, valor ${l.value}€` : ''}`).join('\n')
    : '- Não está em nenhuma pipeline ativa'
  const visitText: Record<string, string> = { muitas: 'muitas visitas', poucas: 'poucas visitas', nenhuma: 'sem visitas' }
  const propsText = ctx.properties.length
    ? ctx.properties.map(p => `- ${p.label} (${p.role}, ${p.status}${p.visit_activity ? `, ${visitText[p.visit_activity] ?? p.visit_activity}` : ''})`).join('\n')
    : '- Nenhum'

  return `És um consultor sénior de vendas imobiliárias em Portugal a orientar um agente. Analisa TODA a informação do contacto e diz exatamente qual o próximo passo, como abordar a pessoa e porquê. Sê concreto e prático, nada genérico — usa as características, o historial e o estado dos imóveis.

HOJE: ${weekday}, ${today.toLocaleDateString('pt-PT')}

CONTACTO:
- Nome: ${person.name}
- Tipo(s): ${types}
- Temperatura: ${person.temperature ?? 'não definida'}
- Capacidade financeira: ${person.financial_capacity ?? 'não definida'}
- Origem: ${person.source ?? 'não definida'}
${detailLines.join('\n')}
${daysSinceLast !== null ? `- Dias desde última interação: ${daysSinceLast}` : '- Sem interações anteriores'}
${nextCall}
- Chamadas: ${calls.length} no total, ${answered} atendidas${missedStreak > 0 ? `, ${missedStreak} tentativa(s) seguida(s) sem resposta` : ''}

CARACTERÍSTICAS (como lidar com esta pessoa — RESPEITA-AS):
${(person.traits ?? []).length ? person.traits.map(t => `- ${t}`).join('\n') : '- Nenhuma registada'}

NOTAS DO AGENTE:
${person.notes?.trim() || 'Sem notas.'}

NEGÓCIOS:
${leadsText}

IMÓVEIS ASSOCIADOS:
${propsText}

HISTORIAL RECENTE (mais recente primeiro):
${history || 'Sem interações registadas.'}

Regras:
- Se há várias chamadas sem resposta, sugere outro canal (WhatsApp/email) ou outro horário (vê a que horas/dias atendeu antes).
- Se as características indicam dia/hora/canal preferido, a ação tem de os respeitar (ex: hoje não é fim de semana → agenda para sábado).
- Se um imóvel tem poucas ou nenhuma visita, considera rever preço/anúncio com o vendedor; se tem muitas, aproveita para criar urgência junto de compradores.
- Escreve em português de Portugal.

Responde em JSON com exatamente este formato (sem markdown, sem texto extra):
{"action": "próxima ação concreta (máx 90 chars)", "reason": "porquê, com base nos dados (máx 160 chars)", "urgency": "alta|media|baixa", "channel": "chamada|whatsapp|email|visita|reuniao", "when": "quando fazer (ex: hoje ao fim da tarde, sábado de manhã)", "tips": ["dica de abordagem 1", "dica 2", "dica 3"], "next_call_in_days": número de dias até ao próximo contacto ou null}`
}

export type VoiceEntity = 'contact' | 'interaction' | 'lead' | 'organization' | 'property' | 'activity' | 'visit'

const VOICE_ENTITY_SCHEMAS: Record<Exclude<VoiceEntity, 'contact' | 'interaction'>, { intro: string; schema: string }> = {
  lead: {
    intro: 'Um agente imobiliário descreveu um novo lead (potencial cliente) em voz alta.',
    schema: `{"name": string, "email": string|null, "phone": string|null, "zone": string|null, "typology": string|null, "budget": número inteiro em euros ou null (ex: 370000, não "370.000 €"), ${NOTES_FIELD_INSTRUCTION}}`,
  },
  organization: {
    intro: 'Um agente imobiliário descreveu uma nova organização/empresa parceira em voz alta.',
    schema: `{"name": string, "email": string|null, "phone": string|null, "website": string|null, ${NOTES_FIELD_INSTRUCTION}}`,
  },
  property: {
    intro: 'Um agente imobiliário descreveu um novo imóvel para catalogar em voz alta.',
    schema: `{"title": string, "type": "apartamento"|"moradia"|"terreno"|"loja"|"escritorio"|"armazem"|"outro"|null, "price": número inteiro em euros ou null, "area_m2": número inteiro ou null, "typology": string|null, "bedrooms": número inteiro ou null, "bathrooms": número inteiro ou null, "zone": string|null, "address": string|null, ${NOTES_FIELD_INSTRUCTION}}`,
  },
  activity: {
    intro: 'Um agente imobiliário descreveu uma atividade (chamada, visita, reunião, tarefa ou nota) em voz alta.',
    schema: '{"type": "chamada"|"visita"|"email"|"reuniao"|"tarefa"|"nota"|"whatsapp", "title": string, "description": string|null}',
  },
  visit: {
    intro: 'Um agente imobiliário descreveu quem visitou um imóvel em voz alta.',
    schema: '{"visitor_name": string|null, "agency_name": string|null, "notes": string|null}',
  },
}

// Prompt único para todas as gravações de voz da app. 'contact' e 'interaction'
// reaproveitam os prompts já existentes e testados; as restantes entidades
// partilham a mesma estrutura de instruções, só muda o esquema de campos.
export function buildEntityExtractionPrompt(entity: VoiceEntity, transcript: string): string {
  if (entity === 'contact') return buildContactExtractionPrompt(transcript)
  if (entity === 'interaction') return buildInteractionExtractionPrompt(transcript)

  const { intro, schema } = VOICE_ENTITY_SCHEMAS[entity]
  return [
    intro,
    `Transcrição: """${transcript}"""`,
    `Devolve APENAS JSON válido (sem texto extra) com este formato:`,
    schema,
    `Se um campo não for mencionado, omite-o ou usa null. Nunca inventes valores.`,
  ].join('\n')
}
