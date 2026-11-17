import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityType } from '@/types'

export type MirrorTarget =
  | { kind: 'person'; id: string }
  | { kind: 'lead'; id: string }

interface MirrorNotificationParams {
  supabase: SupabaseClient
  agencyId: string
  assignedTo: string
  notificationId: string
  title: string
  description?: string | null
  type?: ActivityType
  target: MirrorTarget | null
}

// Deduz o contacto/lead a partir do link da notificação (/leads/<id> ou
// /people/<id>). Notificações sem alvo (ex. /recommendations) também vão
// para o calendário, só sem ligação.
export function targetFromLink(link?: string | null): MirrorTarget | null {
  const m = link?.match(/^\/(leads|people)\/([0-9a-f-]{36})/i)
  if (!m) return null
  return m[1] === 'leads' ? { kind: 'lead', id: m[2] } : { kind: 'person', id: m[2] }
}

// Espelha uma notificação como `activity` (source 'notification') para que o
// calendário mostre tudo o que o utilizador tem de fazer. Chamado a partir de
// createNotification (lib/notifications.ts) para TODAS as notificações, exceto
// as que já se referem a uma atividade existente (ex. cron task-reminders).
//
// Idempotente: nunca cria uma segunda activity para a mesma notification_id.
// A verificação prévia evita a maioria dos casos; o índice único parcial
// `activities_notification_unique_idx` é a rede de segurança.
export async function mirrorNotificationToCalendar(params: MirrorNotificationParams): Promise<void> {
  const { supabase, agencyId, assignedTo, notificationId, title, description, type, target } = params

  const { data: existing, error: existingError } = await supabase
    .from('activities')
    .select('id')
    .eq('notification_id', notificationId)
    .maybeSingle()

  if (existingError) {
    console.error('Failed to check existing mirrored activity:', existingError.message)
  }

  if (existing) return

  const { error } = await supabase.from('activities').insert({
    agency_id: agencyId,
    lead_id: target?.kind === 'lead' ? target.id : null,
    person_id: target?.kind === 'person' ? target.id : null,
    assigned_to: assignedTo,
    type: type ?? 'tarefa',
    title,
    description: description ?? null,
    due_date: new Date().toISOString(),
    completed: false,
    source: 'notification',
    notification_id: notificationId,
  })

  // 23505 = unique_violation — outra execução já espelhou esta notificação
  // entretanto (corrida entre crons); não é um erro real, ignorar.
  if (error && (error as { code?: string }).code !== '23505') {
    console.error('Failed to mirror notification to calendar:', error.message)
  }
}
