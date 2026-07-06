// components/contacts/ContactTypeChips.tsx
import { contactTypeMeta } from '@/lib/contacts/constants'

export function ContactTypeChips({ types, size = 11 }: { types: string[]; size?: number }) {
  if (!types || types.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {types.map(t => {
        const meta = contactTypeMeta(t)
        if (!meta) return null
        return (
          <span key={t} style={{
            fontSize: size, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
            background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}33`,
          }}>{meta.label}</span>
        )
      })}
    </div>
  )
}
