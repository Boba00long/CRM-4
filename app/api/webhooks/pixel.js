import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// A 1x1 transparent GIF, base64-encoded
const TRANSPARENT_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  'base64'
)

export default async function handler(req, res) {
  const { id } = req.query

  if (id) {
    try {
      // Only set opened_at if it hasn't already been recorded (first open wins)
      const { data: existing } = await supabase
        .from('interactions')
        .select('opened_at')
        .eq('tracking_id', id)
        .single()

      if (existing && !existing.opened_at) {
        await supabase
          .from('interactions')
          .update({ opened_at: new Date().toISOString() })
          .eq('tracking_id', id)
      }
    } catch {
      // Never let tracking errors block the pixel from rendering
    }
  }

  res.setHeader('Content-Type', 'image/gif')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.status(200).send(TRANSPARENT_PIXEL)
}
