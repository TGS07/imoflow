import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import type { AgencyOnboardingStatus } from '@/types'
import type { LayoutMode } from '@/components/layout/LayoutToggle'

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

  const cookieStore = await cookies()
  const layoutCookie = cookieStore.get('layout')?.value
  const userLayout: LayoutMode = layoutCookie === 'topbar' ? 'topbar' : 'sidebar'

  return (
    <ErrorBoundary>
      <AppShell
        userName={profile?.name ?? user.email ?? ''}
        userEmail={user.email ?? ''}
        userInitials={profile?.avatar_initials ?? 'XX'}
        userRole={profile?.role === 'admin' ? 'admin' : 'agent'}
        userTheme={profile?.theme === 'dark' ? 'dark' : 'light'}
        userLayout={userLayout}
      >
        {children}
      </AppShell>
    </ErrorBoundary>
  )
}
