import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const WINDOWS = [
  { key: '1d', label: 'Last 24 Hours', days: 1 },
  { key: '7d', label: 'Last 7 Days', days: 7 },
  { key: '30d', label: 'Last 30 Days', days: 30 },
]

export default function AnalyticsView() {
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeWindow, setActiveWindow] = useState('7d')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      // Pull everything within the last 30 days — covers all three window options
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const { data, error } = await supabase
        .from('interactions')
        .select('type, occurred_at, replied_at')
        .gte('occurred_at', since.toISOString())
      if (!error) setInteractions(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const windowConfig = WINDOWS.find((w) => w.key === activeWindow)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - windowConfig.days)

    const inWindow = interactions.filter((i) => new Date(i.occurred_at) >= cutoff)

    const emails = inWindow.filter((i) => i.type === 'Email')
    const calls = inWindow.filter((i) => i.type === 'Call')
    const meetings = inWindow.filter((i) => i.type === 'Meeting')
    const other = inWindow.filter((i) => i.type === 'Other')

    const emailsReplied = emails.filter((i) => i.replied_at).length
    const replyRate = emails.length > 0 ? (emailsReplied / emails.length) * 100 : 0

    return {
      totalTouches: inWindow.length,
      emails: emails.length,
      calls: calls.length,
      meetings: meetings.length,
      other: other.length,
      emailsReplied,
      replyRate,
    }
  }, [interactions, activeWindow])

  const dailyBreakdown = useMemo(() => {
    const windowConfig = WINDOWS.find((w) => w.key === activeWindow)
    const days = []
    for (let i = windowConfig.days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const dayInteractions = interactions.filter((int) => {
        const d = new Date(int.occurred_at)
        return d >= date && d < nextDate
      })

      days.push({
        date,
        emails: dayInteractions.filter((i) => i.type === 'Email').length,
        calls: dayInteractions.filter((i) => i.type === 'Call').length,
        total: dayInteractions.length,
      })
    }
    return days
  }, [interactions, activeWindow])

  const maxDayTotal = Math.max(1, ...dailyBreakdown.map((d) => d.total))

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, margin: 0, color: 'var(--color-paper)' }}>
            Analytics
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 6, fontSize: 14.5 }}>
            Outreach activity and response rates
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setActiveWindow(w.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${activeWindow === w.key ? 'var(--color-gold)' : 'var(--color-border)'}`,
                background: activeWindow === w.key ? 'rgba(201,167,105,0.12)' : 'transparent',
                color: activeWindow === w.key ? 'var(--color-gold)' : 'var(--color-text-secondary)',
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
            <StatCard label="Total Touches" value={stats.totalTouches} icon="◈" />
            <StatCard label="Emails Sent" value={stats.emails} icon="✉" />
            <StatCard label="Calls Made" value={stats.calls} icon="☎" />
            <StatCard label="Meetings" value={stats.meetings} icon="◔" />
            <StatCard
              label="Reply Rate"
              value={`${stats.replyRate.toFixed(0)}%`}
              icon="↩"
              sublabel={`${stats.emailsReplied} of ${stats.emails} emails`}
              highlight
            />
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
            <h3 style={{ fontSize: 13, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 0, marginBottom: 20 }}>
              Daily Activity
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: dailyBreakdown.length > 14 ? 3 : 8, height: 160 }}>
              {dailyBreakdown.map((day, idx) => (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: '100%',
                      height: 130,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      position: 'relative',
                    }}
                    title={`${day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${day.emails} emails, ${day.calls} calls`}
                  >
                    <div
                      style={{
                        width: '100%',
                        background: 'var(--color-gold)',
                        borderRadius: '3px 3px 0 0',
                        height: `${(day.total / maxDayTotal) * 130}px`,
                        minHeight: day.total > 0 ? 3 : 0,
                        opacity: 0.85,
                      }}
                    />
                  </div>
                  {dailyBreakdown.length <= 14 && (
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                      {day.date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, sublabel, highlight }) {
  return (
    <div
      style={{
        background: highlight ? 'rgba(201,167,105,0.08)' : 'var(--color-surface)',
        border: `1px solid ${highlight ? 'var(--color-gold)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '16px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 14, color: 'var(--color-gold)' }}>{icon}</span>
        <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-paper)', lineHeight: 1 }}>{value}</div>
      {sublabel && <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 4 }}>{sublabel}</div>}
    </div>
  )
}
