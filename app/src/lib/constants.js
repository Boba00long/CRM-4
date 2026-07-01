export const STAGE_LABELS = [
  'Not Started',
  'Touch 1',
  'Touch 2',
  'Touch 3',
  'Touch 4',
  'Touch 5',
  'Touch 6',
  'Connected',
]

export const STATUS_OPTIONS = ['New', 'In Sequence', 'Connected', 'Follow-Up', 'Closed']

export const INTERACTION_TYPES = ['Email', 'Call', 'Meeting', 'Other']

export const INDUSTRY_OPTIONS = [
  'Property Management',
  'Commercial Brokerage',
  'Architecture',
  'Interior Design',
  'Structural Engineering',
  'Remodeling Finance / Lending',
  'Franchise Development',
  'Other',
]

export const SOURCE_OPTIONS = ['LinkedIn', 'Referral', 'Event', 'Cold List', 'Other']

// Given current stage, return the next stage (capped at 7 = Connected)
export function advanceStage(currentStage) {
  if (currentStage >= 7) return 7
  return currentStage + 1
}

// Suggested next-action date: 1 month out while in sequence, 3 months once connected
export function suggestNextActionDate(stage) {
  const date = new Date()
  if (stage >= 7) {
    date.setMonth(date.getMonth() + 3)
  } else {
    date.setMonth(date.getMonth() + 1)
  }
  return date.toISOString().split('T')[0]
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function isOverdue(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr + 'T00:00:00') < new Date(new Date().toDateString())
}
