type Props = {
  name?: string
  initials?: string
  src?: string
  size?: number
}

function getColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const colors = ['#B07D2E', '#059669', '#2563EB', '#7C3AED', '#DC2626', '#8C6B2E', '#C9A84C']
  return colors[Math.abs(hash) % colors.length]
}

export function Avatar({ name = '', initials, src, size = 32 }: Props) {
  const letters = initials || name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${getColor(name)}, ${getColor(name + 'x')})`,
      }}
    >
      {letters}
    </div>
  )
}
