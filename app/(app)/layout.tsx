import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, avatar_initials, role')
    .eq('id', user.id)
    .single()

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? ''}
      userInitials={profile?.avatar_initials ?? 'XX'}
      userRole={profile?.role === 'admin' ? 'admin' : 'agent'}
    >
      {children}
    </AppShell>
  )
}
