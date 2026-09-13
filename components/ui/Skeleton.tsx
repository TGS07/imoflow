type Props = {
  variant?: 'text' | 'card' | 'table-row' | 'avatar'
  width?: string
  height?: string
  count?: number
}

export function Skeleton({ variant = 'text', width, height, count = 1 }: Props) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`skeleton skeleton-${variant}`} style={{ width, height }} />
      ))}
    </>
  )
}
