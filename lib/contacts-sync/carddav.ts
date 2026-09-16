export interface RawVCard {
  url: string
  etag: string
  data: string
}

const BASE = 'https://contacts.icloud.com'

function authHeaders(username: string, password: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    'Content-Type': 'application/xml; charset=utf-8',
    'User-Agent': 'ImoFlow/1.0',
    ...extra,
  }
}

async function propfind(url: string, username: string, password: string, body: string, depth = '0'): Promise<string> {
  const res = await fetch(url, {
    method: 'PROPFIND',
    headers: authHeaders(username, password, { Depth: depth }),
    body,
  })
  if (!res.ok && res.status !== 207) {
    throw new Error(`PROPFIND ${url} returned ${res.status} ${res.statusText}`)
  }
  return res.text()
}

async function davReport(url: string, username: string, password: string, body: string): Promise<string> {
  const res = await fetch(url, {
    method: 'REPORT',
    headers: authHeaders(username, password, { Depth: '1' }),
    body,
  })
  if (!res.ok && res.status !== 207) {
    throw new Error(`REPORT ${url} returned ${res.status} ${res.statusText}`)
  }
  return res.text()
}

function extractHrefs(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}[^>]*>\\s*<(?:d:|D:|DAV:)?href>([^<]+)<`, 'gi')
  const results: string[] = []
  let m
  while ((m = pattern.exec(xml)) !== null) {
    results.push(m[1])
  }
  return results
}

function extractHref(xml: string, tag: string): string | null {
  const hrefs = extractHrefs(xml, tag)
  return hrefs[0] ?? null
}

function extractResponseVCards(xml: string): RawVCard[] {
  const cards: RawVCard[] = []
  const responsePattern = /<(?:d:|D:|DAV:)?response>([\s\S]*?)<\/(?:d:|D:|DAV:)?response>/gi
  let rm
  while ((rm = responsePattern.exec(xml)) !== null) {
    const block = rm[1]
    const hrefMatch = block.match(/<(?:d:|D:|DAV:)?href>([^<]+)</)
    const etagMatch = block.match(/<(?:d:|D:|DAV:)?getetag>([^<]+)</)
    const dataMatch = block.match(/<(?:card:|C:)?address-data[^>]*>([\s\S]*?)<\/(?:card:|C:)?address-data>/)

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
  const principalXml = await propfind(BASE, username, appPassword,
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>'
  )
  const principalPath = extractHref(principalXml, 'current-user-principal')
  if (!principalPath) throw new Error('Could not discover principal URL')

  const homeXml = await propfind(`${BASE}${principalPath}`, username, appPassword,
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">' +
    '<d:prop><card:addressbook-home-set/></d:prop></d:propfind>'
  )
  const homePath = extractHref(homeXml, 'addressbook-home-set')
  if (!homePath) throw new Error('Could not discover addressbook home')

  const booksXml = await propfind(`${BASE}${homePath}`, username, appPassword,
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">' +
    '<d:prop><d:resourcetype/></d:prop></d:propfind>',
    '1'
  )

  const responseHrefPattern = /<(?:d:|D:|DAV:)?response>[\s\S]*?<(?:d:|D:|DAV:)?href>([^<]+)<[\s\S]*?<\/(?:d:|D:|DAV:)?response>/gi
  const bookPaths: string[] = []
  let bm
  while ((bm = responseHrefPattern.exec(booksXml)) !== null) {
    const href = bm[1]
    if (href !== homePath && href.startsWith(homePath)) {
      bookPaths.push(href)
    }
  }

  const cards: RawVCard[] = []

  for (const bookPath of bookPaths) {
    try {
      const vcardXml = await davReport(`${BASE}${bookPath}`, username, appPassword,
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<card:addressbook-query xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">' +
        '<d:prop><d:getetag/><card:address-data/></d:prop>' +
        '</card:addressbook-query>'
      )
      cards.push(...extractResponseVCards(vcardXml))
    } catch {
      // skip address books that fail (e.g. groups)
    }
  }

  return cards
}
