type Props = {
  name?: string
  initials?: string
  src?: string
  size?: number
}

function getColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const colors = ['#4A3F2E', '#354F44', '#3A4F63', '#4A4260', '#5A3838', '#3E3828', '#4E4632']
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
