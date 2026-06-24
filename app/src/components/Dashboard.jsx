import { useState } from 'react'
import { STATUS_OPTIONS, formatDate, isOverdue } from '../lib/constants'
import SequenceRail from './SequenceRail'

export default function Dashboard({ contacts, loading, openContact, setView }) {
  const [collapsed, setCollapsed] = useState({})

  const byStatus = STATUS_OPTIONS.reduce((acc, status) => {
    acc[status] = contacts.filter((c) => c.status === status)
    return acc
  }, {})

  const overdueCount = contacts.filter((c) => isOverdue(c.next_action_date)).length

  const toggleCollapsed = (status) => {
    setCollapsed((c) => ({ ...c, [status]: !c[status] }))
  }

  return (
    <div>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, margin: 0, color: 'var(--color-paper)' }}>
          Pipeline
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 6, fontSize: 14.5 }}>
          {contacts.length} total contacts
          {overdueCount > 0 && (
            <span style={{ color: 'var(--color-danger)', marginLeft: 10 }}>
              · {overdueCount} overdue for action
            </span>
          )}
        </p>
      </header>

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
      ) : contacts.length === 0 ? (
        <EmptyState setView={setView} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: STATUS_OPTIONS.map((s) => (collapsed[s] ? '56px' : 'minmax(220px, 1fr)')).join(' '),
            gap: 16,
            alignItems: 'start',
            transition: 'grid-template-columns 0.2s ease',
          }}
        >
          {STATUS_OPTIONS.map((status) => (
            <StatusColumn
              key={status}
              status={status}
              contacts={byStatus[status]}
              openContact={openContact}
              isCollapsed={!!collapsed[status]}
              onToggle={() => toggleCollapsed(status)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatusColumn({ status, contacts, openContact, isCollapsed, onToggle }) {
  if (isCollapsed) {
    return (
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          padding: '14px 8px',
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={onToggle}
        title={`Expand ${status}`}
      >
        <button
          aria-label={`Expand ${status}`}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            fontSize: 14,
            padding: 4,
            marginBottom: 12,
          }}
        >
          ▸
        </button>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
          }}
        >
          {status}
        </div>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 12 }}>{contacts.length}</span>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: 14,
        minHeight: 200,
      }}
    >
      <div
        onClick={onToggle}
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>▾</span>
          {status}
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>{contacts.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {contacts.map((c) => (
          <div
            key={c.id}
            onClick={() => openContact(c.id)}
            style={{
              background: 'var(--color-panel)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 12px',
              cursor: 'pointer',
              border: '1px solid transparent',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-gold)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-paper)' }}>
              {c.full_name}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {c.company_name || '—'}
            </div>
            <div style={{ marginTop: 10 }}>
              <SequenceRail stage={c.sequence_stage || 0} size="sm" />
            </div>
            {c.next_action_date && (
              <div
                style={{
                  fontSize: 11.5,
                  marginTop: 8,
                  color: isOverdue(c.next_action_date) ? 'var(--color-danger)' : 'var(--color-text-muted)',
                }}
              >
                Next: {formatDate(c.next_action_date)}
              </div>
            )}
          </div>
        ))}
        {contacts.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '8px 4px' }}>
            No contacts here
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ setView }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px dashed var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '64px 32px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-paper)', marginBottom: 8 }}>
        No contacts yet
      </div>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14.5, marginBottom: 20 }}>
        Import a CSV of leads or add your first contact to get the pipeline moving.
      </p>
      <button
        onClick={() => setView('import')}
        style={{
          background: 'var(--color-gold)',
          color: 'var(--color-bg)',
          border: 'none',
          padding: '10px 20px',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Import contacts
      </button>
    </div>
  )
}
