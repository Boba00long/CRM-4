import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Pipeline', icon: '◈' },
  { key: 'contacts', label: 'All Contacts', icon: '☷' },
  { key: 'followups', label: 'Follow-Ups', icon: '◷' },
  { key: 'analytics', label: 'Analytics', icon: '▤' },
  { key: 'import', label: 'Import CSV', icon: '↥' },
]

export default function Sidebar({ view, setView, contactCount }) {
  const [gmailStatus, setGmailStatus] = useState({ loading: true, connected: false, email: null })

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/auth/google/status')
        const data = await res.json()
        setGmailStatus({ loading: false, connected: data.connected, email: data.email || null })
      } catch {
        setGmailStatus({ loading: false, connected: false, email: null })
      }
    }
    checkStatus()
  }, [])

  return (
    <aside
      style={{
        width: 240,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        padding: '32px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}
    >
      <div style={{ marginBottom: 36, paddingLeft: 8 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--color-paper)',
            lineHeight: 1.1,
          }}
        >
          RIA Group
        </div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--color-gold)',
            textTransform: 'uppercase',
            marginTop: 4,
          }}
        >
          Outreach CRM
        </div>
      </div>

      {NAV_ITEMS.map((item) => {
        const active = view === item.key || (item.key === 'contacts' && view === 'contact-detail')
        return (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: active ? 'var(--color-panel)' : 'transparent',
              color: active ? 'var(--color-paper)' : 'var(--color-text-secondary)',
              fontSize: 14.5,
              fontWeight: active ? 600 : 500,
              textAlign: 'left',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = 'var(--color-panel)'
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = 'transparent'
            }}
          >
            <span style={{ fontSize: 15, color: active ? 'var(--color-gold)' : 'inherit' }}>{item.icon}</span>
            {item.label}
            {item.key === 'contacts' && (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted)' }}>
                {contactCount}
              </span>
            )}
          </button>
        )
      })}

      <div style={{ marginTop: 'auto' }}>
        {gmailStatus.loading ? null : gmailStatus.connected ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              background: 'var(--color-success-bg)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 12,
            }}
            title={gmailStatus.email}
          >
            <span style={{ color: 'var(--color-success)', fontSize: 13 }}>●</span>
            <span style={{ fontSize: 12.5, color: 'var(--color-success)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Gmail Connected
            </span>
          </div>
        ) : (
          <a
            href="/api/auth/google/start"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 12px',
              background: 'var(--color-panel)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 12,
              fontSize: 12.5,
              color: 'var(--color-gold)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Connect Gmail
          </a>
        )}
        <div style={{ paddingLeft: 8, fontSize: 11.5, color: 'var(--color-text-muted)' }}>
          Six-touch outreach tracker
        </div>
      </div>
    </aside>
  )
}
