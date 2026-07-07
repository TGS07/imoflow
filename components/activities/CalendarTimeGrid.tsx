// components/activities/CalendarTimeGrid.tsx
// Grelha de horas estilo Google Calendar, usada pelas vistas Dia (1 coluna)
// e Semana (7 colunas). Scroll vertical pelas 24h, linha da hora atual,
// eventos posicionados/dimensionados pela hora de início/fim.
'use client'
import { useEffect, useRef, useState } from 'react'
import type { Activity, ActivityType } from '@/types'

const HOUR_H = 48 // px por hora
const GUTTER_W = 52 // largura da coluna das horas
const DEFAULT_EVENT_MIN = 45 // duração assumida quando não há end_date (minutos)

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

type LaidOutEvent = {
  activity: Activity
  startMin: number
  endMin: number
  col: number
  cols: number
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Distribui eventos sobrepostos em colunas lado a lado (estilo Google Calendar)
function layoutDayEvents(dayEvents: { activity: Activity; startMin: number; endMin: number }[]): LaidOutEvent[] {
  const sorted = [...dayEvents].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
  const result: LaidOutEvent[] = []
  let cluster: LaidOutEvent[] = []
  let clusterEnd = -1
  let colEnds: number[] = []

  const flush = () => {
    for (const e of cluster) e.cols = colEnds.length
    result.push(...cluster)
    cluster = []
    colEnds = []
  }

  for (const e of sorted) {
    if (cluster.length && e.startMin >= clusterEnd) flush()
    let col = colEnds.findIndex(end => end <= e.startMin)
    if (col === -1) { col = colEnds.length; colEnds.push(e.endMin) }
    else colEnds[col] = e.endMin
    cluster.push({ ...e, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, e.endMin)
  }
  flush()
  return result
}

type Props = {
  days: Date[] // 1 dia (vista Dia) ou 7 dias (vista Semana)
  activities: Activity[]
  colors: Record<ActivityType, string>
  icons: Record<ActivityType, string>
  onEventClick: (a: Activity) => void
  onSlotClick: (start: Date) => void
  onDayHeaderClick?: (day: Date) => void
}

export function CalendarTimeGrid({ days, activities, colors, icons, onEventClick, onSlotClick, onDayHeaderClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())

  // Linha "agora" atualiza a cada minuto
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Auto-scroll para as 08:00 ao montar
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_H - 10
  }, [])

  const isWeek = days.length > 1
  const nowMin = now.getHours() * 60 + now.getMinutes()

  function eventsFor(day: Date) {
    const evts = activities
      .filter(a => a.due_date && sameDay(new Date(a.due_date), day))
      .map(a => {
        const start = new Date(a.due_date!)
        const startMin = start.getHours() * 60 + start.getMinutes()
        let endMin = startMin + DEFAULT_EVENT_MIN
        if (a.end_date) {
          const end = new Date(a.end_date)
          if (sameDay(end, day) && end > start) endMin = end.getHours() * 60 + end.getMinutes()
          else if (end > start) endMin = 24 * 60 // atravessa a meia-noite: até ao fim do dia
        }
        return { activity: a, startMin, endMin: Math.min(Math.max(endMin, startMin + 20), 24 * 60) }
      })
    return layoutDayEvents(evts)
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Cabeçalho dos dias (fixo) */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingRight: 6 }}>
        <div style={{ width: GUTTER_W, flexShrink: 0 }} />
        {days.map((day, i) => {
          const today = sameDay(day, now)
          return (
            <div
              key={i}
              onClick={() => onDayHeaderClick?.(day)}
              style={{
                flex: 1, minWidth: 0, textAlign: 'center', padding: '8px 4px',
                cursor: onDayHeaderClick ? 'pointer' : 'default',
                borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: today ? 'var(--gold)' : 'var(--muted)', fontWeight: 600 }}>
                {WEEKDAYS[(day.getDay() + 6) % 7]}
              </div>
              <div style={{
                width: 28, height: 28, lineHeight: '28px', margin: '2px auto 0', borderRadius: '50%',
                fontSize: 14, fontWeight: today ? 700 : 400,
                color: today ? '#fff' : 'var(--text)',
                background: today ? 'var(--gold)' : 'transparent',
              }}>
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Corpo com scroll pelas 24 horas */}
      <div ref={scrollRef} style={{ overflowY: 'auto', height: 'min(64vh, 620px)', position: 'relative' }}>
        <div style={{ display: 'flex', height: 24 * HOUR_H, position: 'relative' }}>
          {/* Coluna das horas */}
          <div style={{ width: GUTTER_W, flexShrink: 0, position: 'relative' }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ position: 'absolute', top: h * HOUR_H - 7, right: 8, fontSize: 10, color: 'var(--muted)' }}>
                {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>

          {/* Colunas dos dias */}
          {days.map((day, di) => {
            const laid = eventsFor(day)
            const today = sameDay(day, now)
            return (
              <div key={di} style={{ flex: 1, minWidth: 0, position: 'relative', borderLeft: '1px solid var(--border)' }}>
                {/* Linhas das horas + clique para criar */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    onClick={() => {
                      const d = new Date(day)
                      d.setHours(h, 0, 0, 0)
                      onSlotClick(d)
                    }}
                    style={{ position: 'absolute', top: h * HOUR_H, left: 0, right: 0, height: HOUR_H, borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  />
                ))}

                {/* Eventos */}
                {laid.map(({ activity: a, startMin, endMin, col, cols }) => {
                  const color = colors[a.type]
                  const top = (startMin / 60) * HOUR_H
                  const height = Math.max(((endMin - startMin) / 60) * HOUR_H - 2, 18)
                  const width = 100 / cols
                  return (
                    <div
                      key={a.id}
                      onClick={e => { e.stopPropagation(); onEventClick(a) }}
                      title={a.title}
                      style={{
                        position: 'absolute',
                        top,
                        left: `calc(${col * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                        height,
                        background: `${color}1A`,
                        borderLeft: `3px solid ${color}`,
                        borderRadius: 4,
                        padding: '2px 4px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        opacity: a.completed ? 0.45 : 1,
                        zIndex: 2,
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 600, color, textDecoration: a.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {!isWeek && icons[a.type]} {a.title}
                      </div>
                      {height >= 34 && a.due_date && (
                        <div style={{ fontSize: 9.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {new Date(a.due_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          {a.end_date && `–${new Date(a.end_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`}
                          {!isWeek && a.leads && ` · ${a.leads.name}`}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Linha da hora atual */}
                {today && (
                  <div style={{ position: 'absolute', top: (nowMin / 60) * HOUR_H, left: 0, right: 0, zIndex: 3, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: -4, top: -3.5, width: 8, height: 8, borderRadius: '50%', background: '#EA4335' }} />
                    <div style={{ height: 2, background: '#EA4335' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
