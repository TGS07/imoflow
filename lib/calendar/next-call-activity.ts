import type { SupabaseClient } from '@supabase/supabase-js'
import { parseCallFromNotes } from '@/lib/contacts/note-call-date'

export const DEFAULT_NEXT_CALL_TIME = '10:00'

// Converte "YYYY-MM-DD" + "HH:MM" em hora de Lisboa para ISO (UTC), sem
// depender do fuso do servidor (a Vercel corre em UTC).
export function lisbonToIso(date: string, time: string = DEFAULT_NEXT_CALL_TIME): string {
  const asUtc = new Date(`${date}T${time}:00Z`)
  const lisbon = new Date(asUtc.toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }))
  const utc = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(asUtc.getTime() - (lisbon.getTime() - utc.getTime())).toISOString()
}

type PersonForCall = { id: string; name: string; agency_id: string; assigned_to: string | null; phone?: string | null }

// Mantém UMA atividade 'chamada' aberta (source 'next_call') por contacto,
// alinhada com people.next_call_at: substitui a anterior ao reagendar e
// remove-a quando a próxima chamada é limpa.
export async function syncNextCallActivity(
  supabase: SupabaseClient,
  person: PersonForCall,
  nextCallAt: string | null,
  dueIso: string | null,
  fallbackUserId: string,
): Promise<void> {
  const { error: delError } = await supabase
    .from('activities')
    .delete()
    .eq('person_id', person.id)
    .eq('source', 'next_call')
    .eq('completed', false)
  if (delError) console.error('Failed to clear next-call activity:', delError.message)

  if (!nextCallAt) return

  const due = dueIso && !Number.isNaN(Date.parse(dueIso)) ? new Date(dueIso).toISOString() : lisbonToIso(nextCallAt)
  const { error } = await supabase.from('activities').insert({
    agency_id: person.agency_id,
    person_id: person.id,
    lead_id: null,
    assigned_to: person.assigned_to ?? fallbackUserId,
    type: 'chamada',
    title: `Ligar: ${person.name}`,
    description: person.phone ? `Próxima chamada agendada · ${person.phone}` : 'Próxima chamada agendada',
    due_date: due,
    completed: false,
    source: 'next_call',
  })
  if (error) console.error('Failed to create next-call activity:', error.message)
}

// Quando a chamada é registada (interação), a atividade fica concluída.
export async function completeNextCallActivity(supabase: SupabaseClient, personId: string): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq('person_id', personId)
    .eq('source', 'next_call')
    .eq('completed', false)
  if (error) console.error('Failed to complete next-call activity:', error.message)
}

// Data de hoje em Lisboa (YYYY-MM-DD), independente do fuso do servidor.
export function todayLisbon(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(now)
}

// Quando as notas dizem "ligar a 25/11 - 17h", agenda a próxima chamada do
// contacto nesse dia/hora (e a entrada no calendário). Só datas de hoje em
// diante, e só se for diferente da que já está marcada.
export async function applyNoteCall(
  supabase: SupabaseClient,
  personId: string,
  notes: string | null | undefined,
  fallbackUserId: string,
): Promise<string | null> {
  const found = parseCallFromNotes(notes)
  if (!found || found.date < todayLisbon()) return null

  const { data: person } = await supabase
    .from('people')
    .select('id, name, agency_id, assigned_to, phone, next_call_at')
    .eq('id', personId)
    .maybeSingle()
  if (!person || person.next_call_at === found.date) return null

  const { error } = await supabase.from('people').update({ next_call_at: found.date }).eq('id', personId)
  if (error) {
    console.error('Failed to set next_call_at from notes:', error.message)
    return null
  }
  await syncNextCallActivity(supabase, person, found.date, lisbonToIso(found.date, found.time ?? DEFAULT_NEXT_CALL_TIME), fallbackUserId)
  return found.date
}
