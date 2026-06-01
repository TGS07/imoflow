export type ReportPeriod = '30d' | '90d' | '6m' | '1y'

export type ReportsKpis = {
  total_leads: number
  won_leads: number
  conversion_rate: number  // percentagem 0-100, arredondada a 1 decimal
  pipeline_value: number
  avg_close_days: number | null
}

export type FunnelItem = {
  stage_id: string
  name: string
  position: number
  count: number
}

export type SourceItem = {
  source: string
  count: number
}

export type TimeItem = {
  week: string  // ISO date string da segunda-feira da semana
  count: number
}

export type AgentItem = {
  user_id: string
  name: string
  won_count: number
}

export type ReportsData = {
  kpis: ReportsKpis
  funnel: FunnelItem[]
  by_source: SourceItem[]
  over_time: TimeItem[]
  by_agent: AgentItem[]
}
