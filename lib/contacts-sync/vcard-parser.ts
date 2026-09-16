export interface ParsedContact {
  uid: string
  fullName: string
  emails: string[]
  phones: string[]
  birthday: string | null
  address: string | null
  notes: string | null
  siglas: string[]
}

function getField(vcard: string, field: string): string | null {
  const regex = new RegExp(`^${field}[;:](.*)$`, 'im')
  const match = vcard.match(regex)
  return match ? match[1].trim() : null
}

function getAllFields(vcard: string, field: string): string[] {
  const regex = new RegExp(`^${field}[;:](.*)$`, 'gim')
  const results: string[] = []
  let match
  while ((match = regex.exec(vcard)) !== null) {
    results.push(match[1].trim())
  }
  return results
}

function extractValue(line: string): string {
  const colonIdx = line.indexOf(':')
  return colonIdx >= 0 ? line.substring(colonIdx + 1).trim() : line.trim()
}

function decodeName(vcard: string): string {
  const fnLine = getField(vcard, 'FN')
  if (fnLine) return extractValue(fnLine.includes(':') ? fnLine : `:${fnLine}`)

  const nLine = getField(vcard, 'N')
  if (nLine) {
    const val = extractValue(nLine.includes(':') ? nLine : `:${nLine}`)
    const parts = val.split(';').map((p) => p.trim()).filter(Boolean)
    return parts.length >= 2 ? `${parts[1]} ${parts[0]}` : parts.join(' ')
  }

  return ''
}

function parsePhones(vcard: string): string[] {
  const lines = getAllFields(vcard, 'TEL')
  return lines.map((l) => {
    const val = extractValue(l.includes(':') ? l : `:${l}`)
    return val.replace(/[^\d+]/g, '')
  }).filter(Boolean)
}

function parseEmails(vcard: string): string[] {
  const lines = getAllFields(vcard, 'EMAIL')
  return lines.map((l) => {
    const val = extractValue(l.includes(':') ? l : `:${l}`)
    return val.toLowerCase()
  }).filter(Boolean)
}

function parseBirthday(vcard: string): string | null {
  const line = getField(vcard, 'BDAY')
  if (!line) return null
  const val = extractValue(line.includes(':') ? line : `:${line}`)
  const match = val.match(/(\d{4})-?(\d{2})-?(\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  return null
}

function parseAddress(vcard: string): string | null {
  const line = getField(vcard, 'ADR')
  if (!line) return null
  const val = extractValue(line.includes(':') ? line : `:${line}`)
  const parts = val.split(';').map((p) => p.trim()).filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

function parseNotes(vcard: string): string | null {
  const line = getField(vcard, 'NOTE')
  if (!line) return null
  return extractValue(line.includes(':') ? line : `:${line}`) || null
}

function parseUid(vcard: string): string {
  const line = getField(vcard, 'UID')
  if (!line) return ''
  return extractValue(line.includes(':') ? line : `:${line}`)
}

export function extractSiglas(name: string, knownCodes: string[]): string[] {
  const found: string[] = []
  for (const code of knownCodes) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'i')
    if (regex.test(name)) found.push(code.toUpperCase())
  }
  return found
}

export function cleanName(name: string, siglas: string[]): string {
  let cleaned = name
  for (const s of siglas) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '')
  }
  return cleaned.replace(/\s+/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '').trim()
}

export function parseVCard(vcard: string): ParsedContact | null {
  if (!vcard.includes('BEGIN:VCARD')) return null

  const fullName = decodeName(vcard)
  if (!fullName) return null

  return {
    uid: parseUid(vcard),
    fullName,
    emails: parseEmails(vcard),
    phones: parsePhones(vcard),
    birthday: parseBirthday(vcard),
    address: parseAddress(vcard),
    notes: parseNotes(vcard),
    siglas: [],
  }
}
