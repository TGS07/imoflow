import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({})

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile?.agency_id) return NextResponse.json({})

  const agencyId = profile.agency_id
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

  const [
    leadsRes,
    activitiesRes,
    contactsRes,
    propertiesRes,
    recsRes,
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, pipeline_stages(name)', { count: 'exact' })
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(3),

    supabase
      .from('activities')
      .select('id, title, type, due_date', { count: 'exact' })
      .eq('agency_id', agencyId)
      .gte('due_date', todayStart)
      .lt('due_date', todayEnd)
      .order('due_date', { ascending: true })
      .limit(3),

    supabase
      .from('contacts')
      .select('id, name, phone', { count: 'exact' })
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(3),

    supabase
      .from('properties')
      .select('id, title, price, status', { count: 'exact' })
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(3),

    supabase
      .from('idealista_matches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['pending', 'edited']),
  ])

  const pipeline = {
    total: leadsRes.count ?? 0,
    recent: (leadsRes.data ?? []).map(l => ({
      name: l.name,
      stage: (l.pipeline_stages as unknown as { name: string })?.name ?? '',
    })),
  }

  const activities = {
    today: activitiesRes.count ?? 0,
    upcoming: (activitiesRes.data ?? []).map(a => ({
      title: a.title,
      type: a.type,
      time: a.due_date ? new Date(a.due_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '',
    })),
  }

  const contacts = {
    total: contactsRes.count ?? 0,
    recent: (contactsRes.data ?? []).map(c => ({
      name: c.name,
      phone: c.phone ?? '',
    })),
  }

  const properties = {
    total: propertiesRes.count ?? 0,
    recent: (propertiesRes.data ?? []).map(p => ({
      title: p.title,
      price: p.price,
      status: p.status,
    })),
  }

  return NextResponse.json({
    pipeline,
    activities,
    contacts,
    properties,
    recommendations: { pending: recsRes.count ?? 0 },
  })
}
