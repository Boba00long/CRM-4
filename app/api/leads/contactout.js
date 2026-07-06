import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Pull the first non-empty string out of a value that may be a string, array, or missing
function first(val) {
  if (!val) return ''
  if (Array.isArray(val)) return val.find((v) => typeof v === 'string' && v.trim()) || ''
  if (typeof val === 'string') return val
  return ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!process.env.CONTACTOUT_API_KEY) {
    res.status(500).json({ error: 'CONTACTOUT_API_KEY is not configured in Vercel environment variables' })
    return
  }

  const { linkedinUrl } = req.body || {}
  if (!linkedinUrl || !/linkedin\.com\/in\//i.test(linkedinUrl)) {
    res.status(400).json({ error: 'Please provide a standard LinkedIn profile URL (linkedin.com/in/...)' })
    return
  }

  // Normalize: strip query params and trailing slash
  const cleanUrl = linkedinUrl.split('?')[0].replace(/\/$/, '')

  try {
    const coRes = await fetch(
      `https://api.contactout.com/v1/people/linkedin?profile=${encodeURIComponent(cleanUrl)}&include_phone=true`,
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          token: process.env.CONTACTOUT_API_KEY,
        },
      }
    )

    const data = await coRes.json()

    if (!coRes.ok) {
      const msg = data?.message || data?.error || `ContactOut returned ${coRes.status}`
      res.status(502).json({ error: `ContactOut lookup failed: ${msg}` })
      return
    }

    // ContactOut response shapes vary slightly; handle the common ones defensively
    const p = data.profile || data.data || data

    const fullName =
      first(p.full_name) ||
      [first(p.first_name), first(p.last_name)].filter(Boolean).join(' ').trim() ||
      first(p.name)

    if (!fullName) {
      res.status(404).json({ error: 'No profile data found for that LinkedIn URL' })
      return
    }

    const workEmail = first(p.work_email) || first(p.work_emails)
    const personalEmail = first(p.personal_email) || first(p.personal_emails)
    const anyEmail = first(p.email) || first(p.emails)
    const email = (workEmail || personalEmail || anyEmail || '').toLowerCase()

    const companyName =
      (p.company && typeof p.company === 'object' ? first(p.company.name) : first(p.company)) ||
      first(p.company_name)

    const location =
      typeof p.location === 'object' && p.location !== null
        ? first(p.location.default) || first(p.location.short) || ''
        : first(p.location)

    // Duplicate check by email (case-insensitive)
    if (email) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id, full_name')
        .ilike('email', email)
        .limit(1)
        .maybeSingle()

      if (existing) {
        res.status(409).json({ error: `Already in CRM: ${existing.full_name} has this email` })
        return
      }
    }

    const contact = {
      full_name: fullName,
      title: first(p.title) || first(p.headline),
      email: email || null,
      phone: first(p.phone) || first(p.phones) || null,
      company_name: companyName || null,
      company_industry: first(p.industry) || null,
      location: location || null,
      source: cleanUrl,
      ai_summary: first(p.headline) || first(p.summary) || null,
      status: 'New',
      sequence_stage: 0,
      next_action_date: new Date().toISOString().split('T')[0],
    }

    const { data: inserted, error: insertError } = await supabase
      .from('contacts')
      .insert([contact])
      .select()
      .single()

    if (insertError) {
      res.status(500).json({ error: 'Failed to save contact: ' + insertError.message })
      return
    }

    res.status(200).json({ contact: inserted, hadEmail: !!email })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
