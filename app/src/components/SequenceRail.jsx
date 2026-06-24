// Visualizes progress through the flexible six-touch sequence as a row of dots.
// Filled gold = touch completed. Hollow = pending. A check mark at the end = connected.
export default function SequenceRail({ stage, size = 'md' }) {
  const dotSize = size === 'sm' ? 7 : 9
  const gap = size === 'sm' ? 5 : 7

  if (stage >= 7) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: size === 'sm' ? 11 : 12.5,
            fontWeight: 600,
            color: 'var(--color-success)',
          }}
        >
          ✓ Connected
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }} title={`Touch ${stage} of 6`}>
      {[1, 2, 3, 4, 5, 6].map((touch) => (
        <div
          key={touch}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: touch <= stage ? 'var(--color-gold)' : 'transparent',
            border: touch <= stage ? 'none' : '1.5px solid var(--color-text-muted)',
            boxShadow: touch === stage ? '0 0 0 3px rgba(201,167,105,0.2)' : 'none',
            transition: 'all 0.2s',
          }}
        />
      ))}
    </div>
  )
}
