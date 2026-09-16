import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import type { AgencyOnboardingStatus } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, avatar_initials, role, theme, agencies(onboarding_completed)')
    .eq('id', user.id)
    .single()

  const agency = profile?.agencies as unknown as AgencyOnboardingStatus | null
  if (agency?.onboarding_completed === false) redirect('/onboarding')

  return (
    <ErrorBoundary>
      <AppShell
        userName={profile?.name ?? user.email ?? ''}
        userInitials={profile?.avatar_initials ?? 'XX'}
        userRole={profile?.role === 'admin' ? 'admin' : 'agent'}
        userTheme={profile?.theme === 'dark' ? 'dark' : 'light'}
      >
        {children}
      </AppShell>
    </ErrorBoundary>
  )
}
