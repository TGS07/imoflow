// lib/calendar/ics.ts
// Gerador puro do feed ICS (RFC 5545, subconjunto mínimo VEVENT). Sem
// dependências externas — o formato é simples e não há nenhuma lib "ics" já
// instalada no projeto (ver docs/superpowers/specs/2026-07-28-notificacoes-calendario-design.md).

export type IcsEvent = {
  id: string
  title: string
  description: string
  dueDate: string // ISO 8601
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function formatIcsDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

// VCALENDAR com um VEVENT por atividade. Usa quebras de linha CRLF, como
// exige a RFC 5545 — a maioria dos clientes tolera LF, mas seguimos a spec
// à letra para evitar problemas de parsing no Notion/Google/Apple Calendar.
export function buildIcsFeed(events: IcsEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ImoFlow//Calendario de Notificacoes//PT',
    'CALSCALE:GREGORIAN',
  ]

  const stamp = formatIcsDate(new Date().toISOString())
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@imoflow.pt`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatIcsDate(event.dueDate)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(event.description)}`,
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
