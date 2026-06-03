import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/auth/reset-password', request.url))
  }

  return NextResponse.redirect(new URL('/dashboard', request.url))
}
