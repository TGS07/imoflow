import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RecommendationsCarousel } from './RecommendationsCarousel'
import type { Match } from './RecommendationsCarousel'

export default async function RecommendationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/login')

  const { data: matches } = await supabase
    .from('idealista_matches')
    .select(`
      id, status, drafted_message, created_at,
      idealista_listings(titulo, zona, tipologia, preco, m2, extras, link),
      leads(id, name, phone, email)
    `)
    .eq('user_id', user.id)
    .eq('agency_id', userData.agency_id)
    .in('status', ['pending', 'edited'])
    .order('created_at', { ascending: false })

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>
          Recomendações
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          Imóveis do Idealista que encaixam nas preferências dos seus leads
        </p>
      </div>
      {/* Nota: `Match` (RecommendationsCarousel.tsx) já é um tipo nomeado que
          espelha exatamente as colunas e joins selecionados acima
          (idealista_listings, leads) — tighten-lo via Database exigiria
          reconstruir os joins aninhados com Pick<> em vários níveis para um
          ganho de clareza marginal, por isso mantém-se como está. */}
      <RecommendationsCarousel matches={(matches ?? []) as unknown as Match[]} />
    </div>
  )
}
