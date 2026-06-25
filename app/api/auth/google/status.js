import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('gmail_auth')
      .select('email, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      res.status(200).json({ connected: false })
      return
    }

    res.status(200).json({ connected: true, email: data.email })
  } catch (err) {
    res.status(200).json({ connected: false })
  }
}
