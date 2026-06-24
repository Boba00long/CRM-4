import { useMemo } from 'react'
import { formatDate, isOverdue } from '../lib/constants'
import SequenceRail from './SequenceRail'

export default function FollowUpsView({ contacts, loading, openContact }) {
  const { overdue, dueSoon, upcoming } = useMemo(() => {
    const withDates = contacts.filter((c) => c.next_action_date)
    const today = new Date(new Date().toDateString())
    const soon = new Date(today)
    soon.setDate(soon.getDate() + 14)

    const overdue = withDates.filter((c) => new Date(c.next_action_date + 'T00:00:00') < today)
    const dueSoon = withDates.filter((c) => {
      const d = new Date(c.next_action_date + 'T00:00:00')
      return d >= today && d <= soon
    })
    const upcoming = withDates.filter((c) => new Date(c.next_action_date + 'T00:00:00') > soon)

    const byDate = (a, b) => new Date(a.next_action_date) - new Date(b.next_action_date)
    return {
      overdue: overdue.sort(byDate),
      dueSoon: dueSoon.sort(byDate),
      upcoming: upcoming.sort(byDate),
    }
  }, [contacts])

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, margin: 0, color: 'var(--color-paper)' }}>
        Follow-Ups
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 6, marginBottom: 28, fontSize: 14.5 }}>
        Contacts due for their next touch, whether that's the next step in your six-touch sequence or a periodic check-in with someone you've already connected with.
      </p>

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Section title="Overdue" color="var(--color-danger)" items={overdue} openContact={openContact} emptyText="Nothing overdue. Nice." />
          <Section title="Due in the Next 2 Weeks" color="var(--color-gold)" items={dueSoon} openContact={openContact} emptyText="Nothing due soon." />
          <Section title="Upcoming" color="var(--color-text-secondary)" items={upcoming} openContact={openContact} emptyText="No upcoming follow-ups scheduled." />
        </div>
      )}
    </div>
  )
}

function Section({ title, color, items, openContact, emptyText }) {
  return (
    <div>
      <h3 style={{ fontSize: 13, color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>{emptyText}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((c) => (
            <div
              key={c.id}
              onClick={() => openContact(c.id)}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-gold)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--color-paper)' }}>{c.full_name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{c.company_name || '—'}</div>
              </div>
              <SequenceRail stage={c.sequence_stage || 0} size="sm" />
              <div style={{ fontSize: 13, color: isOverdue(c.next_action_date) ? 'var(--color-danger)' : 'var(--color-text-secondary)', fontWeight: 600 }}>
                {formatDate(c.next_action_date)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
