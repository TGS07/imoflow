// Mostrado de imediato ao navegar entre páginas, enquanto o servidor carrega
export default function Loading() {
  return (
    <div className="page-pad" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="skeleton" style={{ height: 28, width: 220, borderRadius: 8 }} />
      <div className="skeleton" style={{ height: 16, width: 320, borderRadius: 6 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginTop: 8 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  )
}
