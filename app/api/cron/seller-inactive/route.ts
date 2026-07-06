// app/api/cron/seller-inactive/route.ts
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

const INACTIVE_DAYS = 10

export async function GET(request: Request) { return handle(request) }
export async function POST(request: Request) { return handle(request) }

async function handle(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS)

  // vendedores ativos
  const { data: sellers } = await supabase
    .from('people')
    .select('id, agency_id, name, last_interaction_at, created_at, details')
    .contains('types', ['vendedor'])
    .contains('details', { is_active_seller: true })

  if (!sellers || sellers.length === 0) return NextResponse.json({ processed: 0 })

  // um admin por agência para receber a notificação
  const agencyIds = [...new Set(sellers.map(s => s.agency_id))]
  const { data: admins } = await supabase
    .from('users').select('id, agency_id').eq('role', 'admin').in('agency_id', agencyIds)
  const adminByAgency = new Map<string, string>()
  for (const a of admins ?? []) if (!adminByAgency.has(a.agency_id)) adminByAgency.set(a.agency_id, a.id)

  let processed = 0
  for (const s of sellers) {
    const ref = s.last_interaction_at ? new Date(s.last_interaction_at) : new Date(s.created_at)
    if (ref > cutoff) continue
    const userId = adminByAgency.get(s.agency_id)
    if (!userId) continue
    await createNotification({
      userId, agencyId: s.agency_id, type: 'task_due',
      title: `Vendedor sem contacto: ${s.name}`,
      body: `Já não falas com ${s.name} há mais de ${INACTIVE_DAYS} dias.`,
      link: `/people/${s.id}`,
    }, supabase)
    processed++
  }
  return NextResponse.json({ processed })
}
