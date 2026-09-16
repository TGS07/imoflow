import { createAccount, fetchAddressBooks, fetchVCards } from 'tsdav'

export interface RawVCard {
  url: string
  etag: string
  data: string
}

export async function fetchAllVCards(
  username: string,
  appPassword: string
): Promise<RawVCard[]> {
  const account = await createAccount({
    account: {
      serverUrl: 'https://contacts.icloud.com',
      accountType: 'carddav',
      credentials: {
        username,
        password: appPassword,
      },
    },
    headers: {
      'User-Agent': 'ImoFlow/1.0',
    },
  })

  const addressBooks = await fetchAddressBooks({ account })

  const cards: RawVCard[] = []
  for (const ab of addressBooks) {
    const vcards = await fetchVCards({ addressBook: ab })
    for (const vc of vcards) {
      if (vc.data) {
        cards.push({ url: vc.url, etag: vc.etag ?? '', data: vc.data })
      }
    }
  }

  return cards
}
