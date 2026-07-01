export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { contact, touchNumber } = req.body || {}

  if (!contact || !touchNumber) {
    res.status(400).json({ error: 'contact and touchNumber are required' })
    return
  }

  const name = contact.full_name?.split(' ')[0] || contact.full_name || 'there'
  const company = contact.company_name || 'your company'
  const industry = contact.company_industry || 'your industry'
  const title = contact.title || ''

  const touchContext = {
    1: `This is the very first touchpoint. Introduce RIA Group Construction warmly and professionally. Mention that RIA Group is a luxury residential and commercial construction and remodeling company serving Orange County and Southern California. The goal is to plant a seed — introduce yourself, mention what you do, and express genuine interest in connecting. Keep it short, friendly, and non-pushy. Do NOT ask for a meeting yet. End with something low-commitment like "would love to connect when the timing is right."`,
    2: `This is the first follow-up, sent 4 days after the initial email. Reference that you reached out recently. Add a brief value-add — mention a specific strength of RIA Group relevant to their industry (e.g. for property managers: minimal disruption to tenants, fast turnaround; for architects/designers: collaborative process, clean execution; for brokers: adding value to listings through renovation). Lightly nudge toward a call or brief meeting.`,
    3: `This is the second follow-up, sent 10 days after the previous email. Keep it very brief — 3-4 sentences max. Acknowledge they're busy, restate your value prop in one sentence, and make a direct but easy ask: "Would a quick 15-minute call work sometime this week or next?"`,
    4: `This is the third follow-up, sent 18 days after the previous email. Be direct and confident. Mention you've reached out a couple of times and you genuinely believe there's an opportunity to work together or add value. Make a clear, specific ask — suggest a specific type of meeting (coffee, quick Zoom, phone call) and give them an easy out if timing isn't right.`,
    5: `This is the final follow-up in the sequence, sent 28 days after the previous email. Keep it short and gracious. Let them know this is your last follow-up for now — no pressure. Leave the door open for future collaboration. Wish them well. This should feel human and genuine, not automated.`,
  }

  const industryContext = {
    'Property Management': `They manage commercial or residential properties. RIA Group's value to them: fast, professional construction and remodeling with minimal disruption to tenants and operations. Think lobby renovations, unit upgrades, common area refreshes, and commercial build-outs. They care about reliability, timeline, and keeping their tenants happy.`,
    'Commercial Brokerage': `They're commercial real estate brokers who represent buyers, sellers, landlords, and tenants. RIA Group's value to them: being a trusted referral partner when their clients need construction or tenant improvement work done. Brokers often need a reliable GC they can recommend to close deals or add value to listings.`,
    'Architecture': `They design buildings and spaces. RIA Group's value to them: being the builder who actually executes their vision with precision and craftsmanship. Architects care deeply about quality, attention to detail, and contractors who don't cut corners. Position RIA Group as a collaborative partner who respects the design intent.`,
    'Interior Design': `They design interior spaces for residential and commercial clients. RIA Group's value to them: being the construction partner who can execute their designs flawlessly — custom millwork, high-end finishes, complex installations. Interior designers need a GC they can trust to not ruin their vision on-site.`,
    'Structural Engineering': `They handle structural analysis and design. RIA Group's value to them: being a GC who understands and respects structural requirements, communicates well during construction, and doesn't deviate from engineered plans. Engineers appreciate precision, communication, and a builder who asks the right questions.`,
    'Remodeling Finance / Lending': `They provide financing for home renovations and remodels (like RenoFi, renovation loans, HELOCs). RIA Group's value to them: being a recommended contractor for their borrowers. Lenders and finance companies often get asked "who should I hire?" by their clients — being on their preferred contractor list is the goal.`,
    'Franchise Development': `They develop or own franchise locations that need to be built out — think restaurants, retail, fitness studios, medical offices. RIA Group's value to them: completing commercial build-outs on time and on budget, understanding franchise brand standards, and handling permitting and coordination efficiently.`,
    'Other': `They operate in a related industry. Focus on RIA Group's core strengths: luxury residential and commercial construction and remodeling in Orange County and Southern California, high-quality craftsmanship, reliable timelines, and white-glove client experience.`,
  }

  const industryValue = industryContext[industry] || industryContext['Other']

  const prompt = `You are drafting a cold outreach email on behalf of Josh Pinkas at RIA Group Construction, a luxury residential and commercial construction and remodeling company in Orange County and Southern California.

Contact details:
- Name: ${contact.full_name}
- First name: ${name}
- Title: ${title || 'Unknown'}
- Company: ${company}
- Industry: ${industry}

Industry context (use this to make the email relevant to their world):
${industryValue}

Touch number: ${touchNumber} of 5
Context for this touch: ${touchContext[touchNumber] || touchContext[5]}

Write ONLY the email body (no subject line, no "Dear X" salutation — start directly with the opening line). Sign off as Josh Pinkas, RIA Group Construction. Keep the tone warm, professional, and human — not corporate or templated-sounding. Make it feel personally written, not mass-blasted. 2-4 short paragraphs max.

Also provide a suggested subject line on the very first line in this format:
SUBJECT: [your suggested subject line here]

Then a blank line, then the email body.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      res.status(500).json({ error: data.error?.message || 'Claude API error' })
      return
    }

    const text = data.content?.[0]?.text || ''
    const lines = text.split('\n')
    const subjectLine = lines.find((l) => l.startsWith('SUBJECT:'))
    const subject = subjectLine ? subjectLine.replace('SUBJECT:', '').trim() : `Following up — RIA Group Construction`
    const body = lines.filter((l) => !l.startsWith('SUBJECT:')).join('\n').trim()

    res.status(200).json({ subject, body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
