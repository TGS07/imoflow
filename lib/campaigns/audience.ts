import { createServiceClient } from '@/lib/supabase/service'

export type Audience = 'all'
export const AUDIENCES: Audience[] = ['all']

export type Recipient = { id: string; email: string }

// Campanhas são marketing: quem pediu para não receber fica sempre de fora.
export async function loadRecipients(): Promise<Recipient[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('users').select('id, email').eq('product_updates_opt_out', false)
  if (error) throw new Error(error.message)
  return (data ?? []).filter(u => !!u.email).map(u => ({ id: u.id, email: u.email }))
}

export function countAudiences(recipients: Recipient[]): Record<Audience, number> {
  return { all: recipients.length }
}
