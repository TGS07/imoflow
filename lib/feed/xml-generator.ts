// Gerador do feed XML de imóveis, no formato usado para importação em
// portais imobiliários (CASA/SAPO). É uma transformação pura de dados —
// não faz I/O nem acede à Supabase; quem chama decide que propriedades
// entram (ex: filtrar por status/plano) e passa-as já prontas.
//
// Nota: não temos garantia de estar a reproduzir byte-a-byte o schema
// oficial do CASA/SAPO (tags exatas, ordem, nomes de atributos) — é um
// "best effort" com uma estrutura clara e bem formada, pensado para ser
// facilmente ajustável caso surjam requisitos mais específicos do portal.

export type FeedProperty = {
  id: string
  reference: string | null
  title: string
  type: string
  status: string
  price: number | null
  area_m2: number | null
  typology: string | null
  bedrooms: number | null
  bathrooms: number | null
  description: string | null
  address: string | null
  city: string | null
  zone: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  photos: string[] | null
}

/** Escapa texto para uso seguro dentro de nós XML (evita XML inválido). */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function tag(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return `<${name}></${name}>`
  return `<${name}>${escapeXml(String(value))}</${name}>`
}

function propertyToXml(property: FeedProperty): string {
  const photos = Array.isArray(property.photos) ? property.photos : []
  const photosXml = photos.map((url) => `      <photo><url>${escapeXml(url)}</url></photo>`).join('\n')

  return `  <property id="${escapeXml(property.id)}">
    ${tag('reference', property.reference)}
    ${tag('title', property.title)}
    ${tag('type', property.type)}
    ${tag('status', property.status)}
    ${tag('price', property.price)}
    ${tag('area', property.area_m2)}
    ${tag('typology', property.typology)}
    ${tag('bedrooms', property.bedrooms)}
    ${tag('bathrooms', property.bathrooms)}
    ${tag('description', property.description)}
    <address latitude="${property.latitude ?? ''}" longitude="${property.longitude ?? ''}">
      ${tag('street', property.address)}
      ${tag('city', property.city)}
      ${tag('zone', property.zone)}
      ${tag('postal_code', property.postal_code)}
    </address>
    <photos>
${photosXml}
    </photos>
  </property>`
}

/**
 * Gera o feed XML completo para uma agência a partir de uma lista de
 * imóveis já filtrada pelo chamador (ex: apenas `status = 'disponivel'`).
 */
export function generatePropertiesXml(properties: FeedProperty[], agencyName: string): string {
  const items = properties.map(propertyToXml).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<listing agency="${escapeXml(agencyName)}" generated_at="${new Date().toISOString()}">
${items}
</listing>
`
}
