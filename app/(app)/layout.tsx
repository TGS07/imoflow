import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { NotificationBell } from '@/components/layout/NotificationBell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, avatar_initials')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>
      <Sidebar
        userName={profile?.name ?? user.email ?? ''}
        userInitials={profile?.avatar_initials ?? 'XX'}
      />
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid #e5e7eb',
          background: 'white',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          <NotificationBell />
        </header>
        {children}
      </main>
    </div>
  )
}
