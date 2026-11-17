export type ActivityType = 'chamada' | 'visita' | 'email' | 'reuniao' | 'tarefa' | 'nota' | 'whatsapp'

export type Activity = {
  id: string
  agency_id: string
  lead_id: string | null
  person_id: string | null
  assigned_to: string | null
  type: ActivityType
  title: string
  description: string | null
  due_date: string | null
  end_date: string | null
  completed: boolean
  completed_at: string | null
  // 'projected' = entrada prevista só no ecrã (/api/calendar/upcoming), nunca na BD
  source: 'manual' | 'notification' | 'next_call' | 'projected'
  notification_id: string | null
  created_at: string
  users?: { name: string; avatar_initials: string }
  leads?: { id: string; name: string }
  people?: { id: string; name: string }
}
