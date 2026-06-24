import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_OPTIONS, INDUSTRY_OPTIONS, formatDate, isOverdue } from '../lib/constants'
import SequenceRail from './SequenceRail'

export default function Dashboard({ contacts, loading, openContact, setView }) {
  const [collapsed, setCollapsed] = useState({})
  const [industryFilter, setIndustryFilter] = useState('All')
  const [todayStats, setTodayStats] = useState({ Email: 0, Call: 0, Meeting: 0, Other: 0, loading: true })

  useEffect(() => {
    const loadTodayStats = async () => {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const { data, error } = await supabase
        .from('interactions')
        .select('type')
        .gte('occurred_at', startOfDay.toISOString())
      if (!error && data) {
        const counts = { Email: 0, Call: 0, Meeting: 0, Other: 0 }
        data.forEach((row) => {
          if (counts[row.type] !== undefined) counts[row.type] += 1
        })
        setTodayStats({ ...counts, loading: false })
      } else {
        setTodayStats((s) => ({ ...s, loading: false }))
      }
    }
    loadTodayStats()
  }, [contacts])

  const industriesPresent = useMemo(() => {
    const set = new Set(contacts.map((c) => c.company_industry).filter(Boolean))
    return INDUSTRY_OPTIONS.filter((i) => set.has(i))
  }, [contacts])

  const filteredContacts = useMemo(() => {
    if (industryFilter === 'All') return contacts
    return contacts.filter((c) => c.company_industry === industryFilter)
  }, [contacts, industryFilter])

  const byStatus = STATUS_OPTIONS.reduce((acc, status) => {
    acc[status] = filteredContacts.filter((c) => c.status === status)
    return acc
  }, {})

  const overdueCount = filteredContacts.filter((c) => isOverdue(c.next_action_date)).length

  const toggleCollapsed = (status) => {
    setCollapsed((c) => ({ ...c, [status]: !c[status] }))
  }

  return (
    <div>
      {contacts.length > 0 && <TodayActivity stats={todayStats} />}

      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, margin: 0, color: 'var(--color-paper)' }}>
            Pipeline
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 6, fontSize: 14.5 }}>
            {filteredContacts.length} {industryFilter !== 'All' ? `of ${contacts.length} ` : ''}contacts
            {overdueCount > 0 && (
              <span style={{ color: 'var(--color-danger)', marginLeft: 10 }}>
                · {overdueCount} overdue for action
              </span>
            )}
          </p>
        </div>

        {contacts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Industry</span>
            <div style={{ position: 'relative' }}>
              <select
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  background: 'var(--color-panel)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 36px 8px 12px',
                  color: 'var(--color-text)',
                  fontSize: 13.5,
                  minWidth: 200,
                  cursor: 'pointer',
                }}
              >
                <option value="All">All Industries</option>
                {industriesPresent.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
              <span
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 10,
                  color: 'var(--color-text-muted)',
                  pointerEvents: 'none',
                }}
              >
                ▾
              </span>
            </div>
          </div>
        )}
      </header>

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
      ) : contacts.length === 0 ? (
        <EmptyState setView={setView} />
      ) : filteredContacts.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 14, padding: '24px 0' }}>
          No contacts match the "{industryFilter}" filter.
        </div>
      ) : (
        <>
          {STATUS_OPTIONS.some((s) => collapsed[s]) && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.filter((s) => collapsed[s]).map((status) => (
                <StatusColumn
                  key={status}
                  status={status}
                  contacts={byStatus[status]}
                  openContact={openContact}
                  isCollapsed={true}
                  onToggle={() => toggleCollapsed(status)}
                />
              ))}
            </div>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${STATUS_OPTIONS.filter((s) => !collapsed[s]).length || 1}, minmax(220px, 1fr))`,
              gap: 16,
              alignItems: 'start',
            }}
          >
            {STATUS_OPTIONS.filter((s) => !collapsed[s]).map((status) => (
              <StatusColumn
                key={status}
                status={status}
                contacts={byStatus[status]}
                openContact={openContact}
                isCollapsed={false}
                onToggle={() => toggleCollapsed(status)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function TodayActivity({ stats }) {
  const items = [
    { key: 'Email', label: 'Emails Sent', icon: '✉' },
    { key: 'Call', label: 'Calls Made', icon: '☎' },
    { key: 'Meeting', label: 'Meetings', icon: '◔' },
    { key: 'Other', label: 'Other Touches', icon: '◈' },
  ]

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        marginBottom: 24,
        flexWrap: 'wrap',
      }}
    >
      {items.map((item) => (
        <div
          key={item.key}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 140,
          }}
        >
          <span style={{ fontSize: 16, color: 'var(--color-gold)' }}>{item.icon}</span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-paper)', lineHeight: 1 }}>
              {stats.loading ? '–' : stats[item.key]}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap' }}>
              {item.label} Today
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatusColumn({ status, contacts, openContact, isCollapsed, onToggle }) {
  if (isCollapsed) {
    return (
      <div
        onClick={onToggle}
        title={`Expand ${status}`}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          padding: '10px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>▸</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          {status}
        </span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{contacts.length}</span>
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
