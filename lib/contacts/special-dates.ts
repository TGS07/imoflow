// lib/contacts/special-dates.ts
import type { ContactSpecialDate } from '@/types'

export const REGULAR_INTERVAL_PRESETS = [5, 7, 15, 30, 60, 90] as const

// Algoritmo de Computus (Anonymous Gregorian) — domingo de Páscoa para o ano dado.
export function computeEaster(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

export type SpecialPersonFields = {
  birthday: string | null
  special_notify_christmas: boolean
  special_notify_easter: boolean
  special_notify_birthday: boolean
  special_dates: ContactSpecialDate[]
}

export type SpecialDateMatch = { label: string }

// Datas de hoje (UTC) que batem com Natal/Páscoa/aniversário/datas
// personalizadas ativas neste contacto. Usado pelo cron diário e pelo
// bloco "Hoje" do dashboard — mesma lógica, sem duplicar.
export function matchSpecialDatesToday(person: SpecialPersonFields, today: Date = new Date()): SpecialDateMatch[] {
  const month = today.getUTCMonth() + 1
  const day = today.getUTCDate()
  const matches: SpecialDateMatch[] = []

  if (person.special_notify_christmas && month === 12 && day === 25) {
    matches.push({ label: 'Natal' })
  }
  if (person.special_notify_easter) {
    const easter = computeEaster(today.getUTCFullYear())
    if (easter.month === month && easter.day === day) matches.push({ label: 'Páscoa' })
  }
  if (person.special_notify_birthday && person.birthday) {
    const b = new Date(person.birthday)
    if (b.getUTCMonth() + 1 === month && b.getUTCDate() === day) matches.push({ label: 'Aniversário' })
  }
  for (const sd of person.special_dates ?? []) {
    if (sd.month === month && sd.day === day) matches.push({ label: sd.label })
  }
  return matches
}
