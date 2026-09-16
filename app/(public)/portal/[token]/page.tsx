import { createServiceClient } from '@/lib/supabase/service'
import { getPortalData } from '@/lib/portal/get-portal-data'
import { notFound } from 'next/navigation'
import { PortalView } from '@/components/portal/PortalView'

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServiceClient()

  const data = await getPortalData(supabase, token)
  if (!data) notFound()

  // Só a carga inicial (SSR) regista a visualização — o componente cliente
  // não volta a chamar o GET desta rota, para não duplicar a contagem.
  supabase
    .from('portal_views')
    .insert({ lead_id: data.lead_id, action: 'view' })
    .then(({ error }) => {
      if (error) console.error('[portal] failed to log view', error)
    })

  return <PortalView data={data} token={token} />
}
