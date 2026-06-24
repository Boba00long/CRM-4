import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_OPTIONS, INDUSTRY_OPTIONS, SOURCE_OPTIONS, formatDate, isOverdue } from '../lib/constants'
import SequenceRail from './SequenceRail'

const emptyForm = {
  full_name: '',
  title: '',
  email: '',
  phone: '',
  company_name: '',
  company_website: '',
  company_industry: '',
  company_size: '',
  source: '',
  ai_summary: '',
  notes: '',
}

export default function ContactsView({ contacts, loading, openContact, reload, showToast }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showAddModal, setShowAddModal] = useState(false)

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const matchesSearch =
        !search ||
        c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [contacts, search, statusFilter])

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, margin: 0, color: 'var(--color-paper)' }}>
            All Contacts
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 6, fontSize: 14.5 }}>
            {filtered.length} of {contacts.length} contacts
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
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
          + Add Contact
        </button>
      </header>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          placeholder="Search by name, company, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle({ flex: 1 })}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle({ width: 180 })}>
          <option>All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Name', 'Company', 'Status', 'Sequence', 'Next Action', ''].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, color: 'var(--color-text-muted)' }}>No contacts match.</td></tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openContact(c.id)}
                  style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-panel)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: 'var(--color-paper)' }}>{c.full_name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>{c.title || '—'}</div>
                  </td>
                  <td style={tdStyle}>{c.company_name || '—'}</td>
                  <td style={tdStyle}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={tdStyle}>
                    <SequenceRail stage={c.sequence_stage || 0} size="sm" />
                  </td>
                  <td style={{ ...tdStyle, color: isOverdue(c.next_action_date) ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                    {formatDate(c.next_action_date)}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-gold)', textAlign: 'right' }}>View →</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false)
            reload()
            showToast('Contact added')
          }}
          showToast={showToast}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    New: { bg: 'rgba(96,165,250,0.12)', fg: 'var(--color-info)' },
    'In Sequence': { bg: 'rgba(201,167,105,0.15)', fg: 'var(--color-gold)' },
    Connected: { bg: 'var(--color-success-bg)', fg: 'var(--color-success)' },
    'Follow-Up': { bg: 'rgba(96,165,250,0.12)', fg: 'var(--color-info)' },
    Closed: { bg: 'rgba(255,255,255,0.06)', fg: 'var(--color-text-muted)' },
  }
  const c = colors[status] || colors.New
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 20,
      }}
    >
      {status}
    </span>
  )
}

function AddContactModal({ onClose, onSaved, showToast }) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.full_name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('contacts').insert([{ ...form, status: 'New', sequence_stage: 0 }])
    setSaving(false)
    if (error) {
      showToast('Failed to add contact: ' + error.message, 'error')
    } else {
      onSaved()
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginTop: 0, color: 'var(--color-paper)' }}>
          Add Contact
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Full Name *"><input required value={form.full_name} onChange={set('full_name')} style={inputStyle()} /></Field>
          <Row>
            <Field label="Title"><input value={form.title} onChange={set('title')} style={inputStyle()} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={set('email')} style={inputStyle()} /></Field>
          </Row>
          <Row>
            <Field label="Phone"><input value={form.phone} onChange={set('phone')} style={inputStyle()} /></Field>
            <Field label="Company"><input value={form.company_name} onChange={set('company_name')} style={inputStyle()} /></Field>
          </Row>
          <Row>
            <Field label="Company Website"><input value={form.company_website} onChange={set('company_website')} style={inputStyle()} /></Field>
            <Field label="Industry">
              <select value={form.company_industry} onChange={set('company_industry')} style={inputStyle()}>
                <option value="">Select…</option>
                {INDUSTRY_OPTIONS.map((i) => <option key={i}>{i}</option>)}
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="Company Size"><input placeholder="e.g. 11-50" value={form.company_size} onChange={set('company_size')} style={inputStyle()} /></Field>
            <Field label="Source">
              <select value={form.source} onChange={set('source')} style={inputStyle()}>
                <option value="">Select…</option>
                {SOURCE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </Row>
          <Field label="AI Summary / LinkedIn Notes">
            <textarea rows={2} value={form.ai_summary} onChange={set('ai_summary')} style={inputStyle({ resize: 'vertical' })} />
          </Field>
          <Field label="Notes">
            <textarea rows={2} value={form.notes} onChange={set('notes')} style={inputStyle({ resize: 'vertical' })} />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
            <button type="submit" disabled={saving} style={primaryBtnStyle}>
              {saving ? 'Saving…' : 'Save Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
      <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  )
}

function Row({ children }) {
  return <div style={{ display: 'flex', gap: 12 }}>{children}</div>
}

const thStyle = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}
const tdStyle = { padding: '14px 16px', fontSize: 14, color: 'var(--color-text)' }

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

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 24,
}

const modalStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 28,
  width: 560,
  maxHeight: '85vh',
  overflowY: 'auto',
}

const primaryBtnStyle = {
  background: 'var(--color-gold)',
  color: 'var(--color-bg)',
  border: 'none',
  padding: '10px 20px',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 600,
  fontSize: 14,
}

const secondaryBtnStyle = {
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border)',
  padding: '10px 20px',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 500,
  fontSize: 14,
}
