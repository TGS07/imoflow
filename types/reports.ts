import type { LeadSource } from './index'

export type ReportPeriod = '7d' | '30d' | '90d' | '6m' | '1y'

export type ReportKpis = {
  total_leads: number
  won_leads: number
  conversion_rate: number  // percentagem 0-100, arredondada a 1 decimal
  pipeline_value: number
  avg_close_days: number | null
}

export type ReportFunnelEntry = {
  stage_id: string
  name: string
  position: number
  count: number
}

export type ReportSourceEntry = {
  source: LeadSource
  count: number
}

export type ReportTimeEntry = {
  week_start: string  // ISO date string da segunda-feira da semana
  count: number
}

export type ReportAgentEntry = {
  user_id: string
  name: string
  won_count: number
}

export type ReportsData = {
  kpis: ReportKpis
  funnel: ReportFunnelEntry[]
  by_source: ReportSourceEntry[]
  over_time: ReportTimeEntry[]
  by_agent: ReportAgentEntry[]
}
