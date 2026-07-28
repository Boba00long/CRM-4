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
    1: `First email. Introduce yourself in ONE short line: a general contractor based in Orange County doing commercial and residential construction. Add ONE short line connecting to their world (use the industry context lightly). Then ask: "Do you have time for a quick call to introduce myself?" That's the whole email.`,
    2: `Short follow-up, 4 days later. One line referencing you reached out last week, one line of value relevant to their industry, then ask again for a quick call. 3 sentences max.`,
    3: `Very short follow-up. Acknowledge they're busy in one line, then a simple direct ask: would a quick 10-15 minute call work this week or next? 2-3 sentences max.`,
    4: `Short and confident. You've reached out a few times and believe there's a real fit. Suggest a specific option: a quick call or coffee. Give an easy out if timing is bad. 3 sentences max.`,
    5: `Final short note. Gracious, no pressure — this is your last follow-up for now, door stays open, wish them well. 2-3 sentences max.`,
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

Write ONLY the email body. STRICT FORMAT RULES:
- Start with exactly: "Hello ${name}," on its own line
- Total body length: 2-4 short sentences after the greeting. Never more. Short and clean beats clever.
- Plain, direct, human language — how a busy contractor writes, not a marketer. No fluff like "I hope this finds you well", no "I came across your work", no buzzwords.
- Use the industry context for at most one short clause — don't lecture them about their own industry.
- End with EXACTLY this signature block and nothing else after it:

Josh Pinkas
RIA Group Construction
714-402-2444
josh@riagroupconstruction.com
riagroupconstruction.com

Also provide a suggested subject line on the very first line in this format (keep the subject short and plain too, 4-7 words):
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
