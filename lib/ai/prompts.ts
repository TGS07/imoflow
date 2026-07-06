import type { Lead, Activity } from '@/types'

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
