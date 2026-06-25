import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  STATUS_OPTIONS,
  INTERACTION_TYPES,
  advanceStage,
  suggestNextActionDate,
  formatDate,
} from '../lib/constants'
import SequenceRail from './SequenceRail'

export default function ContactDetail({ contactId, onBack, reload, showToast }) {
  const [contact, setContact] = useState(null)
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [logging, setLogging] = useState(false)
  const [logForm, setLogForm] = useState({ type: 'Email', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: c }, { data: i }] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', contactId).single(),
      supabase.from('interactions').select('*').eq('contact_id', contactId).order('occurred_at', { ascending: false }),
    ])
    setContact(c)
    setInteractions(i || [])
    setLoading(false)
  }, [contactId])

  useEffect(() => {
    load()
  }, [load])

  // Passively check for replies whenever this contact's page is viewed
  useEffect(() => {
    const checkReplies = async () => {
      try {
        const res = await fetch(`/api/email/check-replies?contactId=${contactId}`)
        const data = await res.json()
        if (data.newReplies > 0) {
          load()
          reload()
        }
      } catch {
        // Silent fail — reply checking is a passive enhancement, not critical path
      }
    }
    checkReplies()
  }, [contactId])

  const logInteraction = async (e) => {
    e.preventDefault()
    setLogging(true)

    const { error: interactionError } = await supabase.from('interactions').insert([
      { contact_id: contactId, type: logForm.type, notes: logForm.notes },
    ])

    if (interactionError) {
      showToast('Failed to log interaction: ' + interactionError.message, 'error')
      setLogging(false)
      return
    }

    const newStage = advanceStage(contact.sequence_stage || 0)
    const newStatus = newStage >= 7 ? 'Connected' : 'In Sequence'
    const nextActionDate = suggestNextActionDate(newStage)

    const { error: contactError } = await supabase
      .from('contacts')
      .update({
        sequence_stage: newStage,
        status: newStatus,
        next_action_date: nextActionDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    setLogging(false)
    if (contactError) {
      showToast('Logged interaction, but failed to update stage: ' + contactError.message, 'error')
    } else {
      showToast(`Logged ${logForm.type.toLowerCase()} · moved to ${newStage >= 7 ? 'Connected' : `Touch ${newStage}`}`)
    }
    setLogForm({ type: 'Email', notes: '' })
    load()
    reload()
  }

  const updateField = async (fields) => {
    const { error } = await supabase.from('contacts').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', contactId)
    if (error) {
      showToast('Update failed: ' + error.message, 'error')
    } else {
      load()
      reload()
    }
  }

  const deleteContact = async () => {
    if (!confirm(`Delete ${contact.full_name}? This can't be undone.`)) return
    const { error } = await supabase.from('contacts').delete().eq('id', contactId)
    if (error) {
      showToast('Delete failed: ' + error.message, 'error')
    } else {
      showToast('Contact deleted')
      onBack()
      reload()
    }
  }

  if (loading) return <div style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
  if (!contact) return <div style={{ color: 'var(--color-text-muted)' }}>Contact not found.</div>

  return (
    <div>
      <button onClick={onBack} style={backBtnStyle}>← All Contacts</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, margin: 0, color: 'var(--color-paper)' }}>
            {contact.full_name}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 6, fontSize: 14.5 }}>
            {contact.title ? `${contact.title} · ` : ''}{contact.company_name || 'No company listed'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <SequenceRail stage={contact.sequence_stage || 0} />
          <select
            value={contact.status}
            onChange={(e) => updateField({ status: e.target.value })}
            style={{ ...inputStyle(), marginTop: 12, width: 160 }}
          >
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
        {/* Left column: contact info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Contact Info" onEdit={() => setEditing(!editing)} editing={editing}>
            {editing ? (
              <EditForm contact={contact} onSave={(fields) => { updateField(fields); setEditing(false) }} />
            ) : (
              <>
                <InfoRow label="Email" value={contact.email} link={contact.email ? `mailto:${contact.email}` : null} />
                <InfoRow label="Phone" value={contact.phone} link={contact.phone ? `tel:${contact.phone}` : null} />
                <InfoRow label="Title" value={contact.title} />
                <InfoRow label="Website" value={contact.company_website} link={contact.company_website} />
                <InfoRow label="Industry" value={contact.company_industry} />
                <InfoRow label="Company Size" value={contact.company_size} />
                <InfoRow label="Source" value={contact.source} />
                <InfoRow label="Next Action" value={formatDate(contact.next_action_date)} />
              </>
            )}
          </Panel>

          {contact.ai_summary && (
            <Panel title="AI Summary">
              <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {contact.ai_summary}
              </p>
            </Panel>
          )}

          {contact.notes && (
            <Panel title="Notes">
              <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                {contact.notes}
              </p>
            </Panel>
          )}

          <button onClick={deleteContact} style={dangerBtnStyle}>Delete Contact</button>
        </div>

        {/* Right column: send email + log interaction + history */}
        <div>
          {contact.email && <SendEmailPanel contact={contact} onSent={() => { load(); reload() }} showToast={showToast} />}

          <Panel title="Log an Interaction">
            <form onSubmit={logInteraction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {INTERACTION_TYPES.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setLogForm((f) => ({ ...f, type: t }))}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${logForm.type === t ? 'var(--color-gold)' : 'var(--color-border)'}`,
                      background: logForm.type === t ? 'rgba(201,167,105,0.12)' : 'transparent',
                      color: logForm.type === t ? 'var(--color-gold)' : 'var(--color-text-secondary)',
                      fontSize: 13.5,
                      fontWeight: 600,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <textarea
                placeholder="What did you discuss? Any notes to remember…"
                rows={3}
                value={logForm.notes}
                onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))}
                style={inputStyle({ resize: 'vertical' })}
              />
              <button type="submit" disabled={logging} style={primaryBtnStyle}>
                {logging ? 'Logging…' : `Log ${logForm.type} → Advance to ${contact.sequence_stage >= 7 ? 'Connected' : `Touch ${(contact.sequence_stage || 0) + 1}`}`}
              </button>
            </form>
          </Panel>

          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
              Interaction History
            </h3>
            {interactions.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No interactions logged yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {interactions.map((i) => (
                  <div key={i.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--color-gold)' }}>{i.type}</span>
                        {i.gmail_message_id && (
                          <>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-panel)', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>
                              Sent via Gmail
                            </span>
                            {i.replied_at && (
                              <span style={{ fontSize: 11, color: 'var(--color-info)', background: 'rgba(96,165,250,0.12)', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>
                                ↩ Replied
                              </span>
                            )}
                          </>
                        )}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {new Date(i.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    {i.subject && <p style={{ fontSize: 13, color: 'var(--color-text)', margin: '8px 0 0', fontWeight: 600 }}>{i.subject}</p>}
                    {i.notes && <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', margin: '6px 0 0' }}>{i.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SendEmailPanel({ contact, onSent, showToast }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleSend = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id, to: contact.email, subject, body }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to send email', 'error')
      } else {
        showToast('Email sent and logged')
        setSubject('')
        setBody('')
        setExpanded(false)
        onSent()
      }
    } catch (err) {
      showToast('Failed to send email: ' + err.message, 'error')
    }
    setSending(false)
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{ ...primaryBtnStyle, marginBottom: 16, width: '100%' }}
      >
        ✉ Send Email to {contact.full_name.split(' ')[0]}
      </button>
    )
  }

  return (
    <Panel title={`Send Email to ${contact.email}`}>
      <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={inputStyle()}
          required
        />
        <textarea
          placeholder="Write your message…"
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={inputStyle({ resize: 'vertical' })}
          required
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => setExpanded(false)} style={{ ...secondaryBtnStyle, flex: 1 }}>
            Cancel
          </button>
          <button type="submit" disabled={sending} style={{ ...primaryBtnStyle, flex: 2 }}>
            {sending ? 'Sending…' : 'Send Email'}
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', margin: 0 }}>
          This sends through your connected Gmail account and logs it automatically, advancing the touch sequence.
        </p>
      </form>
    </Panel>
  )
}

function Panel({ title, children, onEdit, editing }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
          {title}
        </h3>
        {onEdit && (
          <button onClick={onEdit} style={{ background: 'none', border: 'none', color: 'var(--color-gold)', fontSize: 12.5, fontWeight: 600 }}>
            {editing ? 'Cancel' : 'Edit'}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value, link }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{label}</span>
      {link && value ? (
        <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, color: 'var(--color-gold)', maxWidth: 180, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </a>
      ) : (
        <span style={{ fontSize: 13.5, color: 'var(--color-text)' }}>{value || '—'}</span>
      )}
    </div>
  )
}

function EditForm({ contact, onSave }) {
  const [form, setForm] = useState({ ...contact })
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <LabeledInput label="Email" value={form.email} onChange={set('email')} />
      <LabeledInput label="Phone" value={form.phone} onChange={set('phone')} />
      <LabeledInput label="Title" value={form.title} onChange={set('title')} />
      <LabeledInput label="Website" value={form.company_website} onChange={set('company_website')} />
      <LabeledInput label="Industry" value={form.company_industry} onChange={set('company_industry')} />
      <LabeledInput label="Company Size" value={form.company_size} onChange={set('company_size')} />
      <LabeledInput label="Next Action Date" type="date" value={form.next_action_date || ''} onChange={set('next_action_date')} />
      <button
        onClick={() =>
          onSave({
            email: form.email,
            phone: form.phone,
            title: form.title,
            company_website: form.company_website,
            company_industry: form.company_industry,
            company_size: form.company_size,
            next_action_date: form.next_action_date || null,
          })
        }
        style={primaryBtnStyle}
      >
        Save Changes
      </button>
    </div>
  )
}

function LabeledInput({ label, ...props }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{label}</span>
      <input {...props} style={inputStyle()} />
    </label>
  )
}

const backBtnStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-secondary)',
  fontSize: 13.5,
  padding: 0,
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
    ...extra,
  }
}

const primaryBtnStyle = {
  background: 'var(--color-gold)',
  color: 'var(--color-bg)',
  border: 'none',
  padding: '11px 0',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 600,
  fontSize: 14,
}

const secondaryBtnStyle = {
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border)',
  padding: '11px 0',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 500,
  fontSize: 14,
}

const dangerBtnStyle = {
  background: 'transparent',
  color: 'var(--color-danger)',
  border: '1px solid var(--color-danger)',
  padding: '9px 0',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 500,
  fontSize: 13.5,
}
