import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { summarizeCommits, type CommitInfo } from '@/lib/release-notes/summarize'
import { sendReleaseEmails } from '@/lib/release-notes/send'

export const maxDuration = 300

// Chamado pela GitHub Action após cada deploy de produção. Idempotente por sha.
export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as
    | { sha?: unknown; commits?: unknown }
    | null
  const sha = typeof body?.sha === 'string' ? body.sha : ''
  const commits: CommitInfo[] = Array.isArray(body?.commits)
    ? body.commits
        .filter((c): c is CommitInfo => typeof c?.sha === 'string' && typeof c?.message === 'string')
        .slice(0, 50)
    : []
  if (!sha) return NextResponse.json({ error: 'sha em falta' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: row, error: insertError } = await supabase
    .from('release_notes')
    .insert({ sha, commits })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') return NextResponse.json({ status: 'duplicate' })
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const finish = (patch: Record<string, unknown>) =>
    supabase.from('release_notes').update(patch).eq('id', row.id)

  let items: string[]
  try {
    items = await summarizeCommits(commits)
  } catch (err) {
    console.error('release-notes summarize failed:', err)
    await finish({ status: 'failed' })
    return NextResponse.json({ status: 'failed', reason: 'summary' }, { status: 502 })
  }

  if (items.length === 0) {
    await finish({ status: 'skipped', summary: [] })
    return NextResponse.json({ status: 'skipped' })
  }

  const baseUrl = process.env.APP_URL ?? new URL(request.url).origin
  const result = await sendReleaseEmails(items, baseUrl)
  const status =
    result.failed === 0 ? 'sent' : result.sent === 0 ? 'failed' : 'partial'

  await finish({
    status,
    summary: items,
    sent_count: result.sent,
    failed_count: result.failed,
    sent_at: new Date().toISOString(),
  })
  return NextResponse.json({ status, ...result })
}
