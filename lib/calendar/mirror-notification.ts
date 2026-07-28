import type { SupabaseClient } from '@supabase/supabase-js'

export type MirrorTarget =
  | { kind: 'person'; id: string }
  | { kind: 'lead'; id: string }

interface MirrorNotificationParams {
  supabase: SupabaseClient
  agencyId: string
  assignedTo: string
  notificationId: string
  title: string
  target: MirrorTarget
}

// Depois de criar uma notificação de acompanhamento (cron contact-followup)
// ou de aviso de etapa (lib/automations/engine.ts, ramo send_notification),
// espelha-a como uma `activity` — tipo 'tarefa' reaproveitado; a distinção
// visual é feita por `source`, não por um tipo novo — SE o contacto/lead
// alvo tiver `calendar_sync_enabled = true`.
//
// Idempotente: nunca cria uma segunda activity para a mesma
// notification_id (protege contra reexecução do cron). A verificação
// prévia evita a maioria dos casos; o índice único parcial
// `activities_notification_unique_idx` (migração 20260728_calendar_sync.sql)
// é a rede de segurança contra corridas entre execuções.
export async function mirrorNotificationToCalendar(params: MirrorNotificationParams): Promise<void> {
  const { supabase, agencyId, assignedTo, notificationId, title, target } = params

  const table = target.kind === 'person' ? 'people' : 'leads'
  const { data: row, error: rowError } = await supabase
    .from(table)
    .select('calendar_sync_enabled')
    .eq('id', target.id)
    .maybeSingle()

  if (rowError) {
    console.error('Failed to check calendar_sync_enabled for mirror-notification:', rowError.message)
  }

  if (!row?.calendar_sync_enabled) return

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
    lead_id: target.kind === 'lead' ? target.id : null,
    person_id: target.kind === 'person' ? target.id : null,
    assigned_to: assignedTo,
    type: 'tarefa',
    title,
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
