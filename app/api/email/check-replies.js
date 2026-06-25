import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  const { contactId } = req.query

  if (!contactId) {
    res.status(400).json({ error: 'contactId is required' })
    return
  }

  try {
    const { data: authRow, error: authError } = await supabase
      .from('gmail_auth')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (authError || !authRow) {
      res.status(200).json({ checked: false, reason: 'Gmail not connected' })
      return
    }

    // Find sent emails for this contact that have a Gmail thread but no recorded reply yet
    const { data: pending, error: pendingError } = await supabase
      .from('interactions')
      .select('id, gmail_thread_id')
      .eq('contact_id', contactId)
      .eq('type', 'Email')
      .not('gmail_thread_id', 'is', null)
      .is('replied_at', null)

    if (pendingError) {
      res.status(500).json({ error: pendingError.message })
      return
    }

    if (!pending || pending.length === 0) {
      res.status(200).json({ checked: true, newReplies: 0 })
      return
    }

    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    oauth2Client.setCredentials({
      access_token: authRow.access_token,
      refresh_token: authRow.refresh_token,
      expiry_date: new Date(authRow.expires_at).getTime(),
    })
    oauth2Client.on('tokens', async (tokens) => {
      const update = { updated_at: new Date().toISOString() }
      if (tokens.access_token) update.access_token = tokens.access_token
      if (tokens.expiry_date) update.expires_at = new Date(tokens.expiry_date).toISOString()
      await supabase.from('gmail_auth').update(update).eq('email', authRow.email)
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    let newReplies = 0
    // De-dupe thread ids so we don't check the same thread twice in one pass
    const uniqueThreads = [...new Set(pending.map((p) => p.gmail_thread_id))]

    for (const threadId of uniqueThreads) {
      try {
        const thread = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'metadata' })
        const messages = thread.data.messages || []

        // More than one message in the thread means a reply (or our own follow-up) landed.
        // Check the most recent message's sender to confirm it's not from us.
        if (messages.length > 1) {
          const lastMessage = messages[messages.length - 1]
          const headers = lastMessage.payload?.headers || []
          const fromHeader = headers.find((h) => h.name === 'From')
          const isFromContact = fromHeader && !fromHeader.value.includes(authRow.email)

          if (isFromContact) {
            const rowsForThread = pending.filter((p) => p.gmail_thread_id === threadId)
            for (const row of rowsForThread) {
              await supabase
                .from('interactions')
                .update({ replied_at: new Date().toISOString() })
                .eq('id', row.id)
              newReplies += 1
            }
          }
        }
      } catch {
        // Skip threads that fail to fetch (e.g. deleted) rather than failing the whole batch
        continue
      }
    }

    // If any replies were found, nudge the contact's status to reflect engagement
    if (newReplies > 0) {
      await supabase
        .from('contacts')
        .update({ status: 'Connected', updated_at: new Date().toISOString() })
        .eq('id', contactId)
    }

    res.status(200).json({ checked: true, newReplies })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
