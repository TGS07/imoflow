import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { Pricing } from '@/components/landing/Pricing'
import { Footer } from '@/components/landing/Footer'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Hero />
      <Features />
      <Pricing />
      <Footer />
    </div>
  )
}
