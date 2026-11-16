export type ContactValues = {
  name: string
  email: string
  subject: string
  message: string
}

export type ContactField = keyof ContactValues
export type ContactErrors = Partial<Record<ContactField, string>>

// This is independent of the public email/social-link configuration. No backend
// is configured by default; merely displaying the form never sends a request.
export const CONTACT_SUBMISSION: Readonly<{ endpoint?: string }> = Object.freeze({})

export const CONTACT_LIMITS = {
  name: { min: 2, max: 100 },
  email: { min: 1, max: 254 },
  subject: { min: 3, max: 150 },
  message: { min: 10, max: 5000 },
} as const

export const CONTACT_FIELDS = ['name', 'email', 'subject', 'message'] as const

export function validateContact(draft: ContactValues): {
  valid: boolean
  values: ContactValues
  errors: ContactErrors
} {
  const values: ContactValues = {
    name: draft.name.trim(),
    email: draft.email.trim(),
    subject: draft.subject.trim(),
    message: draft.message.trim(),
  }
  const errors: ContactErrors = {}
  for (const field of CONTACT_FIELDS) {
    const label = field[0].toUpperCase() + field.slice(1)
    const { min, max } = CONTACT_LIMITS[field]
    if (!values[field]) errors[field] = `${label} is required.`
    else if (values[field].length < min) errors[field] = `${label} must contain at least ${min} characters.`
    else if (values[field].length > max) errors[field] = `${label} must contain no more than ${max} characters.`
  }
  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Enter a valid email address.'
  }
  return { valid: Object.keys(errors).length === 0, values, errors }
}

export const UNCONFIGURED_CONTACT_MESSAGE = 'Message not sent — no submission service configured. Your draft remains here.'

export type ContactSubmissionResult =
  | { state: 'invalid'; errors: ContactErrors; message: string }
  | { state: 'unconfigured' | 'error' | 'success'; message: string }

/** Allow a local /api/ route, or an HTTPS URL explicitly supplied by the caller. */
export function resolveContactEndpoint(endpoint: string): string | undefined {
  const value = endpoint.trim()
  if (!value || value.includes('\\')) return undefined
  try {
    if (value.startsWith('/api/')) {
      const url = new URL(value, 'https://contact.invalid')
      if (url.origin !== 'https://contact.invalid' || !url.pathname.startsWith('/api/') || url.hash) return undefined
      return url.pathname + url.search
    }
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return undefined
    return url.href
  } catch {
    return undefined
  }
}

/** Success requires both an OK HTTP response and the JSON acknowledgement. */
export async function submitContact(
  draft: ContactValues,
  endpoint: string | undefined = CONTACT_SUBMISSION.endpoint,
  fetcher: typeof fetch = fetch,
): Promise<ContactSubmissionResult> {
  const validation = validateContact(draft)
  if (!validation.valid) return { state: 'invalid', errors: validation.errors, message: 'Please correct the highlighted fields. Your draft remains here.' }
  if (!endpoint?.trim()) return { state: 'unconfigured', message: UNCONFIGURED_CONTACT_MESSAGE }
  const target = resolveContactEndpoint(endpoint)
  if (!target) return { state: 'error', message: 'Message not sent — configure a /api/ route or an explicit HTTPS submission URL. Your draft remains here.' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetcher(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(validation.values),
      credentials: 'same-origin',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    if (!response.ok) return { state: 'error', message: `Delivery not confirmed — the submission service returned HTTP ${response.status}. Your draft remains here.` }
    const acknowledgement: unknown = await response.json()
    if (typeof acknowledgement !== 'object' || acknowledgement === null || !('success' in acknowledgement) || acknowledgement.success !== true) {
      return { state: 'error', message: 'Delivery not confirmed — the submission service did not acknowledge success. Your draft remains here.' }
    }
    return { state: 'success', message: 'Message submitted — the submission service acknowledged receipt.' }
  } catch {
    return { state: 'error', message: 'Delivery not confirmed — the submission service could not be reached or returned an invalid acknowledgement. Your draft remains here.' }
  } finally {
    clearTimeout(timeout)
  }
}
