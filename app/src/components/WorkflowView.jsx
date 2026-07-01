import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// Days between touches
const TOUCH_DELAYS = { 1: 0, 2: 4, 3: 10, 4: 18, 5: 28 }

// Human-readable touch labels
const TOUCH_LABELS = {
  1: 'Touch 1 — Initial Introduction',
  2: 'Touch 2 — Follow-Up (Day 4)',
  3: 'Touch 3 — Follow-Up (Day 10)',
  4: 'Touch 4 — Direct Ask (Day 18)',
  5: 'Touch 5 — Final Follow-Up (Day 28)',
}

function isOverdueOrDueToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(new Date().toDateString())
  return d <= today
}

export default function WorkflowView({ contacts, openContact, reload, showToast }) {
  const [draftingId, setDraftingId] = useState(null)
  const [drafts, setDrafts] = useState({}) // contactId -> { subject, body, loading }
  const [sending, setSending] = useState(null)

  // Contacts due for their next touch today or overdue, not yet Connected/Closed, not replied
  const due = useMemo(() => {
    return contacts
      .filter((c) => {
        if (c.status === 'Connected' || c.status === 'Closed') return false
        if (!c.next_action_date) return false
        return isOverdueOrDueToday(c.next_action_date)
      })
      .sort((a, b) => new Date(a.next_action_date) - new Date(b.next_action_date))
  }, [contacts])

  const upcoming = useMemo(() => {
    const today = new Date(new Date().toDateString())
    return contacts
      .filter((c) => {
        if (c.status === 'Connected' || c.status === 'Closed') return false
        if (!c.next_action_date) return false
        const d = new Date(c.next_action_date + 'T00:00:00')
        const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
        return diff > 0 && diff <= 7
      })
      .sort((a, b) => new Date(a.next_action_date) - new Date(b.next_action_date))
  }, [contacts])

  const draftEmail = async (contact) => {
    const touchNumber = Math.min((contact.sequence_stage || 0) + 1, 5)
    setDraftingId(contact.id)
    setDrafts((d) => ({ ...d, [contact.id]: { loading: true, subject: '', body: '' } }))

    try {
      const res = await fetch('/api/email/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, touchNumber }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Draft failed')
      setDrafts((d) => ({ ...d, [contact.id]: { loading: false, subject: data.subject, body: data.body } }))
    } catch (err) {
      showToast('Failed to draft email: ' + err.message, 'error')
      setDrafts((d) => ({ ...d, [contact.id]: null }))
      setDraftingId(null)
    }
  }

  const sendEmail = async (contact) => {
    const draft = drafts[contact.id]
    if (!draft || !draft.subject || !draft.body) return
    setSending(contact.id)

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          to: contact.email,
          subject: draft.subject,
          body: draft.body,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      showToast(`Email sent to ${contact.full_name}`)
      setDrafts((d) => ({ ...d, [contact.id]: null }))
      setDraftingId(null)
      reload()
    } catch (err) {
      showToast('Failed to send: ' + err.message, 'error')
    }
    setSending(null)
  }

  const dismissContact = async (contact) => {
    // Push next action date 2 days forward (snooze)
    const next = new Date()
    next.setDate(next.getDate() + 2)
    const { error } = await supabase
      .from('contacts')
      .update({ next_action_date: next.toISOString().split('T')[0], updated_at: new Date().toISOString() })
      .eq('id', contact.id)
    if (!error) {
      showToast(`Snoozed ${contact.full_name} for 2 days`)
      reload()
    }
  }

  return (
    <div>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, margin: 0, color: 'var(--color-paper)' }}>
          Workflow
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 6, fontSize: 14.5 }}>
          Your five-touch outreach sequence — AI-drafted emails ready to review and send.
        </p>
      </header>

      <Section
        title="Due Today / Overdue"
        color="var(--color-gold)"
        items={due}
        draftingId={draftingId}
        drafts={drafts}
        sending={sending}
        onDraft={draftEmail}
        onSend={sendEmail}
        onDismiss={dismissContact}
        onOpen={openContact}
        setDrafts={setDrafts}
        setDraftingId={setDraftingId}
        emptyText="Nothing due — you're all caught up."
      />

      <div style={{ marginTop: 32 }}>
        <Section
          title="Coming Up This Week"
          color="var(--color-text-secondary)"
          items={upcoming}
          draftingId={draftingId}
          drafts={drafts}
          sending={sending}
          onDraft={draftEmail}
          onSend={sendEmail}
          onDismiss={dismissContact}
          onOpen={openContact}
          setDrafts={setDrafts}
          setDraftingId={setDraftingId}
          emptyText="Nothing scheduled for the next 7 days."
          compact
        />
      </div>
    </div>
  )
}

function Section({ title, color, items, emptyText, compact, draftingId, drafts, sending, onDraft, onSend, onDismiss, onOpen, setDrafts, setDraftingId }) {
  return (
    <div>
      <h3 style={{ fontSize: 13, color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>{emptyText}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              compact={compact}
              draftingId={draftingId}
              draft={drafts[c.id]}
              sending={sending}
              onDraft={onDraft}
              onSend={onSend}
              onDismiss={onDismiss}
              onOpen={onOpen}
              setDrafts={setDrafts}
              setDraftingId={setDraftingId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ContactCard({ contact, compact, draftingId, draft, sending, onDraft, onSend, onDismiss, onOpen, setDrafts, setDraftingId }) {
  const touchNumber = Math.min((contact.sequence_stage || 0) + 1, 5)
  const touchLabel = TOUCH_LABELS[touchNumber]
  const daysOverdue = Math.floor((new Date() - new Date(contact.next_action_date + 'T00:00:00')) / (1000 * 60 * 60 * 24))
  const isExpanded = draftingId === contact.id

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${isExpanded ? 'var(--color-gold)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: isExpanded ? 20 : 16,
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-paper)', cursor: 'pointer' }}
              onClick={() => onOpen(contact.id)}
            >
              {contact.full_name}
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {contact.company_name || '—'} {contact.company_industry ? `· ${contact.company_industry}` : ''}
            </span>
          </div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-gold)',
              background: 'rgba(201,167,105,0.12)',
              padding: '3px 10px',
              borderRadius: 20,
            }}>
              {touchLabel}
            </span>
            {daysOverdue > 0 && (
              <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>
                {daysOverdue} day{daysOverdue === 1 ? '' : 's'} overdue
              </span>
            )}
            {daysOverdue === 0 && (
              <span style={{ fontSize: 12, color: 'var(--color-success)' }}>Due today</span>
            )}
            {daysOverdue < 0 && (
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                In {Math.abs(daysOverdue)} day{Math.abs(daysOverdue) === 1 ? '' : 's'}
              </span>
            )}
            {!contact.email && (
              <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>⚠ No email address</span>
            )}
          </div>
        </div>

        {!isExpanded && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => onDismiss(contact)}
              style={ghostBtnStyle}
              title="Snooze 2 days"
            >
              Snooze
            </button>
            {contact.email && (
              <button
                onClick={() => onDraft(contact)}
                style={primaryBtnStyle}
              >
                Draft Email
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && draft && (
        <div style={{ marginTop: 16 }}>
          {draft.loading ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13.5, padding: '20px 0' }}>
              ✦ Drafting personalized email…
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Subject</label>
                <input
                  value={draft.subject}
                  onChange={(e) => setDrafts((d) => ({ ...d, [contact.id]: { ...d[contact.id], subject: e.target.value } }))}
                  style={inputStyle()}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Body — review and edit before sending</label>
                <textarea
                  rows={10}
                  value={draft.body}
                  onChange={(e) => setDrafts((d) => ({ ...d, [contact.id]: { ...d[contact.id], body: e.target.value } }))}
                  style={inputStyle({ resize: 'vertical', lineHeight: 1.6 })}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                Sending to: <strong style={{ color: 'var(--color-text)' }}>{contact.email}</strong>
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setDrafts((d) => ({ ...d, [contact.id]: null })); setDraftingId(null) }}
                  style={{ ...ghostBtnStyle, flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => onDraft(contact)}
                  style={{ ...ghostBtnStyle, flex: 1 }}
                >
                  Redraft
                </button>
                <button
                  onClick={() => onSend(contact)}
                  disabled={sending === contact.id}
                  style={{ ...primaryBtnStyle, flex: 2 }}
                >
                  {sending === contact.id ? 'Sending…' : 'Send Email →'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function inputStyle(extra = {}) {
  return {
    background: 'var(--color-panel)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '9px 12px',
    color: 'var(--color-text)',
    fontSize: 14,
    width: '100%',
    fontFamily: 'var(--font-body)',
    ...extra,
  }
}

const primaryBtnStyle = {
  background: 'var(--color-gold)',
  color: 'var(--color-bg)',
  border: 'none',
  padding: '9px 18px',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 600,
  fontSize: 13.5,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
}

const ghostBtnStyle = {
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border)',
  padding: '9px 14px',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 500,
  fontSize: 13.5,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
}
