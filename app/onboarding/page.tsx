import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id, agencies(onboarding_completed)')
    .eq('id', user.id)
    .single()

  const agencyRow = profile?.agencies as unknown as { onboarding_completed: boolean } | null
  if (agencyRow?.onboarding_completed) redirect('/dashboard')

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse 80% 60% at 50% -15%, rgba(176,125,46,0.07), transparent 70%), var(--bg)',
      padding: 20,
      gap: 32,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'linear-gradient(135deg, #C9A84C, #8B6F30)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
          boxShadow: '0 6px 20px rgba(176,125,46,0.28), inset 0 1px 0 rgba(255,255,255,0.25)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div className="font-display" style={{
          fontSize: 28,
          background: 'linear-gradient(120deg, #B07D2E, #8B6F30)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}>
          ImoFlow
        </div>
        <div style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: 5, opacity: 0.75 }}>
          Vamos configurar a tua conta
        </div>
      </div>

      <OnboardingWizard />
    </div>
  )
}
