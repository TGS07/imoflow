export interface RawVCard {
  url: string
  etag: string
  data: string
}

function authHeaders(username: string, password: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    'Content-Type': 'application/xml; charset=utf-8',
    'User-Agent': 'ImoFlow/1.0',
    ...extra,
  }
}

async function davRequest(
  method: string,
  url: string,
  username: string,
  password: string,
  body: string,
  depth = '0'
): Promise<string> {
  const res = await fetch(url, {
    method,
    headers: authHeaders(username, password, { Depth: depth }),
    body,
  })
  if (!res.ok && res.status !== 207) {
    throw new Error(`${method} ${url} returned ${res.status} ${res.statusText}`)
  }
  return res.text()
}

function findHrefInXml(xml: string): string | null {
  const match = xml.match(/<(?:[a-zA-Z0-9_-]+:)?href[^>]*>([^<]+)</)
  return match ? match[1].trim() : null
}

function resolveUrl(base: string, href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href
  return `${base}${href}`
}

function extractResponseVCards(xml: string): RawVCard[] {
  const cards: RawVCard[] = []
  const responsePattern = /<(?:[a-zA-Z0-9_-]+:)?response>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?response>/gi
  let rm
  while ((rm = responsePattern.exec(xml)) !== null) {
    const block = rm[1]
    const hrefMatch = block.match(/<(?:[a-zA-Z0-9_-]+:)?href[^>]*>([^<]+)</)
    const etagMatch = block.match(/<(?:[a-zA-Z0-9_-]+:)?getetag[^>]*>([^<]+)</)
    const dataMatch = block.match(/<(?:[a-zA-Z0-9_-]+:)?address-data[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?address-data>/)

    if (hrefMatch && dataMatch) {
      const data = dataMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim()
      if (data.includes('BEGIN:VCARD')) {
        cards.push({
          url: hrefMatch[1],
          etag: etagMatch?.[1]?.replace(/"/g, '') ?? '',
          data,
        })
      }
    }
  }
  return cards
}

export async function fetchAllVCards(username: string, appPassword: string): Promise<RawVCard[]> {
  const BASE = 'https://contacts.icloud.com'

  // Step 1: discover principal
  const principalXml = await davRequest('PROPFIND', BASE, username, appPassword,
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>'
  )
  const principalBlock = principalXml.match(/<(?:[a-zA-Z0-9_-]+:)?current-user-principal[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?current-user-principal>/i)
  const principalHref = principalBlock ? findHrefInXml(principalBlock[1]) : null
  if (!principalHref) throw new Error('Could not discover principal URL')
  const principalUrl = resolveUrl(BASE, principalHref)

  // Step 2: discover addressbook home
  const homeXml = await davRequest('PROPFIND', principalUrl, username, appPassword,
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">' +
    '<d:prop><card:addressbook-home-set/></d:prop></d:propfind>'
  )
  const homeBlock = homeXml.match(/<(?:[a-zA-Z0-9_-]+:)?addressbook-home-set[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?addressbook-home-set>/i)
  const homeHref = homeBlock ? findHrefInXml(homeBlock[1]) : null
  if (!homeHref) throw new Error('Could not discover addressbook home')
  const homeUrl = resolveUrl(BASE, homeHref)

  // Step 3: list address books
  const booksXml = await davRequest('PROPFIND', homeUrl, username, appPassword,
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
    '1'
  )

  const bookUrls: string[] = []
  const responsePattern = /<(?:[a-zA-Z0-9_-]+:)?response>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?response>/gi
  let bm
  while ((bm = responsePattern.exec(booksXml)) !== null) {
    const href = findHrefInXml(bm[1])
    if (!href) continue
    const fullUrl = resolveUrl(homeUrl, href)
    if (fullUrl !== homeUrl && fullUrl.startsWith(homeUrl.replace(/\/$/, ''))) {
      bookUrls.push(fullUrl)
    }
  }

  // Step 4: fetch vCards from each address book
  const cards: RawVCard[] = []
  for (const bookUrl of bookUrls) {
    try {
      const vcardXml = await davRequest('REPORT', bookUrl, username, appPassword,
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<card:addressbook-query xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">' +
        '<d:prop><d:getetag/><card:address-data/></d:prop>' +
        '</card:addressbook-query>',
        '1'
      )
      cards.push(...extractResponseVCards(vcardXml))
    } catch {
      // skip address books that fail
    }
  }

  return cards
}
