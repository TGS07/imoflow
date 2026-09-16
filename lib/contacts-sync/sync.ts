import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllVCards } from './carddav'
import { parseVCard, extractSiglas, cleanName, type ParsedContact } from './vcard-parser'

interface SyncResult {
  contacts_seen: number
  contacts_processed: number
}

const SIGLA_TO_TYPE: Record<string, string> = {
  CC: 'cliente_comprador',
  CV: 'cliente_vendedor',
  SCC: 'contabilista',
  SR: 'remodelacoes',
}

export async function syncContacts(
  supabase: SupabaseClient,
  agencyId: string,
  icloudUsername: string,
  icloudAppPassword: string
): Promise<SyncResult> {
  const rawCards = await fetchAllVCards(icloudUsername, icloudAppPassword)

  const { data: siglaRows } = await supabase
    .from('contact_siglas')
    .select('code')
    .eq('agency_id', agencyId)
    .eq('is_active', true)

  const knownCodes = (siglaRows ?? []).map((r) => r.code)

  const parsed: ParsedContact[] = []
  for (const raw of rawCards) {
    const contact = parseVCard(raw.data)
    if (!contact) continue

    const siglas = extractSiglas(contact.fullName, knownCodes)
    if (siglas.length === 0) continue

    contact.siglas = siglas
    contact.fullName = cleanName(contact.fullName, siglas)
    parsed.push(contact)
  }

  let processed = 0

  for (const contact of parsed) {
    const phone = contact.phones[0] ?? null
    const email = contact.emails[0] ?? null

    let existingId: string | null = null

    if (phone) {
      const { data } = await supabase
        .from('people')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('phone', phone)
        .limit(1)
      if (data && data.length > 0) existingId = data[0].id
    }

    if (!existingId && email) {
      const { data } = await supabase
        .from('people')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('email', email)
        .limit(1)
      if (data && data.length > 0) existingId = data[0].id
    }

    const types = contact.siglas
      .map((s) => SIGLA_TO_TYPE[s])
      .filter(Boolean)

    const upsertData: Record<string, unknown> = {
      name: contact.fullName,
      email,
      phone,
      address: contact.address,
      source: 'icloud_sync',
      details: {
        icloud_uid: contact.uid,
        synced_at: new Date().toISOString(),
        ...(contact.notes ? { notes_icloud: contact.notes } : {}),
      },
    }

    if (types.length > 0) upsertData.types = types
    if (contact.birthday) upsertData.birthday = contact.birthday

    if (existingId) {
      await supabase
        .from('people')
        .update(upsertData)
        .eq('id', existingId)
    } else {
      await supabase
        .from('people')
        .insert({ ...upsertData, agency_id: agencyId })
    }

    processed++
  }

  await supabase.from('contacts_sync_runs').insert({
    agency_id: agencyId,
    contacts_seen: rawCards.length,
    contacts_processed: processed,
  })

  return { contacts_seen: rawCards.length, contacts_processed: processed }
}
