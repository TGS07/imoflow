// lib/contacts/followup.ts
// Lógica de "há quanto tempo sem contacto" partilhada pelo cron
// (app/api/cron/contact-followup) e pelo bloco "Hoje" do dashboard.

const DAY_MS = 24 * 60 * 60 * 1000

export function daysSince(ref: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - ref.getTime()) / DAY_MS)
}

export type FollowupResult = {
  due: boolean
  // 'custom' = intervalo próprio do contacto; 1|2 = prazos globais da agência
  tier: 1 | 2 | 'custom' | null
  windowDays: number | null
  daysSince: number
}

// Se `intervalDays` estiver definido (contacto com frequência própria),
// substitui os dois níveis globais da agência por um único nível.
export function followupStatus(
  days: number,
  intervalDays: number | null,
  agencyFirstDays: number,
  agencySecondDays: number
): FollowupResult {
  if (intervalDays != null) {
    const due = days >= intervalDays
    return { due, tier: due ? 'custom' : null, windowDays: due ? intervalDays : null, daysSince: days }
  }
  if (days >= agencySecondDays) return { due: true, tier: 2, windowDays: agencySecondDays, daysSince: days }
  if (days >= agencyFirstDays) return { due: true, tier: 1, windowDays: agencyFirstDays, daysSince: days }
  return { due: false, tier: null, windowDays: null, daysSince: days }
}
