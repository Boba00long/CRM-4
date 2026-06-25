import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  const { code, error } = req.query

  if (error) {
    res.status(400).send(`Google sign-in was cancelled or failed: ${error}`)
    return
  }

  if (!code) {
    res.status(400).send('Missing authorization code from Google.')
    return
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${getBaseUrl(req)}/api/auth/google/callback`
    )

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get the connected account's email address
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    const expiresAt = new Date(tokens.expiry_date).toISOString()

    // Upsert: replace any existing connection for this email
    const { error: dbError } = await supabase
      .from('gmail_auth')
      .upsert(
        {
          email: userInfo.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )

    if (dbError) {
      res.status(500).send(`Connected to Google, but failed to save: ${dbError.message}`)
      return
    }

    // Redirect back to the app with a success flag
    res.redirect(302, `${getBaseUrl(req)}/?gmail_connected=1`)
  } catch (err) {
    res.status(500).send(`OAuth error: ${err.message}`)
  }
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}
