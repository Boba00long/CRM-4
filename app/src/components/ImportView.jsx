import { useState } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { INDUSTRY_OPTIONS } from '../lib/constants'

const FIELD_OPTIONS = [
  { key: '', label: '— Skip this column —' },
  { key: 'full_name', label: 'Full Name' },
  { key: 'title', label: 'Title' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company_name', label: 'Company Name' },
  { key: 'company_website', label: 'Company Website' },
  { key: 'company_industry', label: 'Industry' },
  { key: 'company_size', label: 'Company Size' },
  { key: 'source', label: 'Source' },
  { key: 'ai_summary', label: 'AI Summary / LinkedIn Notes' },
  { key: 'notes', label: 'Notes' },
]

// Guess a sensible auto-mapping based on header names
function guessMapping(headers) {
  const mapping = {}
  headers.forEach((h) => {
    const norm = h.toLowerCase().replace(/[^a-z]/g, '')
    if (/^(name|fullname|contact)$/.test(norm)) mapping[h] = 'full_name'
    else if (/^(title|jobtitle|role|position)$/.test(norm)) mapping[h] = 'title'
    else if (/^email/.test(norm)) mapping[h] = 'email'
    else if (/^(phone|phonenumber|mobile|cell)$/.test(norm)) mapping[h] = 'phone'
    else if (/^(company|companyname|organization|org)$/.test(norm)) mapping[h] = 'company_name'
    else if (/^(website|companywebsite|url|domain)$/.test(norm)) mapping[h] = 'company_website'
    else if (/^(industry|sector|companytype)$/.test(norm)) mapping[h] = 'company_industry'
    else if (/^(size|companysize|employees)$/.test(norm)) mapping[h] = 'company_size'
    else if (/^(source|leadsource)$/.test(norm)) mapping[h] = 'source'
    else if (/^(summary|aisummary|linkedin|about)$/.test(norm)) mapping[h] = 'ai_summary'
    else if (/^notes?$/.test(norm)) mapping[h] = 'notes'
    else mapping[h] = ''
  })
  return mapping
}

// Auto-sort: guess industry tag from company name / title text if not explicitly provided
function guessIndustry(row) {
  const text = `${row.title || ''} ${row.company_name || ''} ${row.ai_summary || ''} ${row.notes || ''}`.toLowerCase()
  if (/property management|reit|asset manager/.test(text)) return 'Property Management'
  if (/broker|brokerage|cbre|jll|colliers|cushman/.test(text)) return 'Commercial Brokerage'
  if (/architect/.test(text)) return 'Architecture'
  if (/interior design/.test(text)) return 'Interior Design'
  if (/structural engineer/.test(text)) return 'Structural Engineering'
  if (/lending|lender|loan|finance|renofi|heloc|renovation loan/.test(text)) return 'Remodeling Finance / Lending'
  if (/franchise|franchisee|franchisor|build.out|buildout/.test(text)) return 'Franchise Development'
  return ''
}

export default function ImportView({ contacts, reload, showToast, setView }) {
  const [step, setStep] = useState('upload') // upload | map | preview | done
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)

  const handleFile = (file) => {
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data
        const cols = results.meta.fields || []
        setRows(data)
        setHeaders(cols)
        setMapping(guessMapping(cols))
        setStep('map')
      },
      error: (err) => showToast('Failed to parse CSV: ' + err.message, 'error'),
    })
  }

  const existingEmails = new Set(
    (contacts || [])
      .map((c) => c.email?.trim().toLowerCase())
      .filter(Boolean)
  )

  const buildMappedRows = () => {
    return rows.map((row) => {
      const mapped = {}
      headers.forEach((h) => {
        const field = mapping[h]
        if (field) mapped[field] = row[h]
      })
      if (!mapped.company_industry) {
        const guessed = guessIndustry(mapped)
        if (guessed) mapped.company_industry = guessed
      }
      mapped.status = 'New'
      mapped.sequence_stage = 0
      mapped.next_action_date = new Date().toISOString().split('T')[0]
      return mapped
    }).filter((r) => r.full_name && r.full_name.trim())
  }

  const splitDuplicates = (mappedRows) => {
    const seen = new Set(existingEmails)
    const fresh = []
    const duplicates = []
    for (const row of mappedRows) {
      const email = row.email?.trim().toLowerCase()
      if (email && seen.has(email)) {
        duplicates.push(row)
      } else {
        if (email) seen.add(email) // catch duplicates within the same CSV too
        fresh.push(row)
      }
    }
    return { fresh, duplicates }
  }

  const handleImport = async () => {
    setImporting(true)
    const mappedRows = buildMappedRows()
    const { fresh } = splitDuplicates(mappedRows)
    const { data, error } = await supabase.from('contacts').insert(fresh).select()
    setImporting(false)
    if (error) {
      showToast('Import failed: ' + error.message, 'error')
      return
    }
    const { duplicates } = splitDuplicates(mappedRows)
    setResults({
      count: data.length,
      skipped: rows.length - mappedRows.length,
      duplicates: duplicates.length,
    })
    setStep('done')
    reload()
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, margin: 0, color: 'var(--color-paper)' }}>
        Import Contacts
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 6, marginBottom: 28, fontSize: 14.5 }}>
        Upload a CSV of leads — we'll map the columns and auto-tag industry where we can.
      </p>

      {step === 'upload' && (
        <div
          style={{
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '64px 32px',
            textAlign: 'center',
            background: 'var(--color-surface)',
          }}
        >
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Drop a CSV file here, or choose one below
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFile(e.target.files[0])}
            style={{ color: 'var(--color-text-secondary)' }}
          />
        </div>
      )}

      {step === 'map' && (
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            We mapped {rows.length} rows from your CSV. Confirm or adjust how each column maps:
          </p>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {headers.map((h) => (
              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, fontSize: 13.5, color: 'var(--color-text)' }}>
                  <strong>{h}</strong>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    e.g. "{rows[0]?.[h] || ''}"
                  </div>
                </div>
                <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                <select
                  value={mapping[h] || ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                  style={{ flex: 1, ...selectStyle }}
                >
                  {FIELD_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button onClick={() => setStep('upload')} style={secondaryBtnStyle}>Back</button>
            <button
              onClick={() => setStep('preview')}
              disabled={!Object.values(mapping).includes('full_name')}
              style={primaryBtnStyle}
            >
              Continue
            </button>
          </div>
          {!Object.values(mapping).includes('full_name') && (
            <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>
              You need to map at least one column to "Full Name" to continue.
            </p>
          )}
        </div>
      )}

      {step === 'preview' && (
        <div>
          {(() => {
            const mappedRows = buildMappedRows()
            const { fresh, duplicates } = splitDuplicates(mappedRows)
            return (
              <>
                <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                  Preview of the first 5 contacts that will be imported — all start at "New" status:
                </p>
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {['Name', 'Company', 'Email', 'Industry (auto-tagged)', 'Status'].map((h) => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mappedRows.slice(0, 5).map((r, idx) => {
                        const isDup = r.email && existingEmails.has(r.email.trim().toLowerCase())
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)', opacity: isDup ? 0.5 : 1 }}>
                            <td style={tdStyle}>{r.full_name}</td>
                            <td style={tdStyle}>{r.company_name || '—'}</td>
                            <td style={tdStyle}>{r.email || '—'}</td>
                            <td style={tdStyle}>
                              {r.company_industry ? (
                                <span style={{ color: 'var(--color-gold)', fontSize: 12.5 }}>{r.company_industry}</span>
                              ) : '—'}
                            </td>
                            <td style={tdStyle}>
                              {isDup ? (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Duplicate — will skip</span>
                              ) : (
                                <span style={{ color: 'var(--color-success)', fontSize: 12 }}>New</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>
                  {fresh.length} new contacts ready to import
                  {duplicates.length > 0 && ` · ${duplicates.length} duplicate${duplicates.length === 1 ? '' : 's'} will be skipped (matching email already in CRM)`}
                  {rows.length - mappedRows.length > 0 && ` · ${rows.length - mappedRows.length} skipped (missing name)`}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setStep('map')} style={secondaryBtnStyle}>Back</button>
                  <button onClick={handleImport} disabled={importing || fresh.length === 0} style={primaryBtnStyle}>
                    {importing ? 'Importing…' : `Import ${fresh.length} New Contact${fresh.length === 1 ? '' : 's'}`}
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {step === 'done' && results && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 40, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--color-success)', marginBottom: 8 }}>
            ✓ Imported {results.count} contacts
          </div>
          {results.duplicates > 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
              {results.duplicates} duplicate{results.duplicates === 1 ? '' : 's'} skipped (already in CRM)
            </p>
          )}
          {results.skipped > 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>{results.skipped} rows skipped (missing name)</p>
          )}
          <button onClick={() => setView('contacts')} style={{ ...primaryBtnStyle, marginTop: 16 }}>
            View Contacts
          </button>
        </div>
      )}
    </div>
  )
}

const thStyle = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
}
const tdStyle = { padding: '12px 16px', fontSize: 13.5, color: 'var(--color-text)' }

const selectStyle = {
  background: 'var(--color-panel)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 10px',
  color: 'var(--color-text)',
  fontSize: 13.5,
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
