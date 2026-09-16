import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { syncContacts } from '@/lib/contacts-sync/sync'

export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: agencies } = await supabase
    .from('agencies')
    .select('id, icloud_username, icloud_app_password')

  if (!agencies || agencies.length === 0) {
    return NextResponse.json({ error: 'No agencies found' }, { status: 404 })
  }

  const results: Record<string, { contacts_seen: number; contacts_processed: number; skipped?: boolean }> = {}

  for (const agency of agencies) {
    if (!agency.icloud_username || !agency.icloud_app_password) {
      results[agency.id] = { contacts_seen: 0, contacts_processed: 0, skipped: true }
      continue
    }

    try {
      results[agency.id] = await syncContacts(
        supabase,
        agency.id,
        agency.icloud_username,
        agency.icloud_app_password
      )
    } catch (err) {
      console.error(`Contacts sync failed for agency ${agency.id}:`, err)
      results[agency.id] = { contacts_seen: 0, contacts_processed: 0 }
    }
  }

  return NextResponse.json({ ok: true, results })
}
