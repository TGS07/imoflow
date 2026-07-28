import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CalendarFeedCard } from '@/components/profile/CalendarFeedCard'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="page-enter page-pad" style={{ padding: '24px 32px' }}>
      <h2 className="font-display" style={{ fontSize: 20, marginBottom: 20 }}>O meu perfil</h2>
      <CalendarFeedCard />
    </div>
  )
}
