import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { contactId, to, subject, body } = req.body || {}

  if (!contactId || !to || !subject || !body) {
    res.status(400).json({ error: 'contactId, to, subject, and body are required' })
    return
  }

  try {
    // Load the connected Gmail account (single-account setup)
    const { data: authRow, error: authError } = await supabase
      .from('gmail_auth')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (authError || !authRow) {
      res.status(400).json({ error: 'No Gmail account connected. Connect Gmail first.' })
      return
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    oauth2Client.setCredentials({
      access_token: authRow.access_token,
      refresh_token: authRow.refresh_token,
      expiry_date: new Date(authRow.expires_at).getTime(),
    })

    // Refresh the access token if needed; googleapis handles this automatically
    // and emits an updated token we should persist.
    oauth2Client.on('tokens', async (tokens) => {
      const update = { updated_at: new Date().toISOString() }
      if (tokens.access_token) update.access_token = tokens.access_token
      if (tokens.expiry_date) update.expires_at = new Date(tokens.expiry_date).toISOString()
      await supabase.from('gmail_auth').update(update).eq('email', authRow.email)
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Create the interaction row first so we have a tracking_id to embed
    const { data: interaction, error: interactionError } = await supabase
      .from('interactions')
      .insert([{ contact_id: contactId, type: 'Email', notes: `Subject: ${subject}`, subject }])
      .select()
      .single()

    if (interactionError) {
      res.status(500).json({ error: 'Failed to create interaction: ' + interactionError.message })
      return
    }

    const baseUrl = getBaseUrl(req)
    const pixelUrl = `${baseUrl}/api/webhooks/pixel?id=${interaction.tracking_id}`
    const htmlBody = `${body.replace(/\n/g, '<br>')}<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`

    const rawMessage = buildRawMessage({ to, subject, htmlBody })

    const sendResult = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage },
    })

    // Save the Gmail message/thread id back onto the interaction for reply tracking later
    await supabase
      .from('interactions')
      .update({
        gmail_message_id: sendResult.data.id,
        gmail_thread_id: sendResult.data.threadId,
      })
      .eq('id', interaction.id)

    // Advance the contact's sequence stage, mirroring the manual "log interaction" behavior
    const { data: contact } = await supabase.from('contacts').select('*').eq('id', contactId).single()
    if (contact) {
      const newStage = Math.min((contact.sequence_stage || 0) + 1, 7)
      const newStatus = newStage >= 7 ? 'Connected' : 'In Sequence'
      const nextActionDate = new Date()
      nextActionDate.setMonth(nextActionDate.getMonth() + (newStage >= 7 ? 3 : 1))

      await supabase
        .from('contacts')
        .update({
          sequence_stage: newStage,
          status: newStatus,
          next_action_date: nextActionDate.toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId)
    }

    res.status(200).json({ success: true, interactionId: interaction.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

function buildRawMessage({ to, subject, htmlBody }) {
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    htmlBody,
  ]
  const message = messageParts.join('\n')
  return Buffer.from(message).toString('base64url')
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}
