import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CONTACT_FIELDS,
  CONTACT_LIMITS,
  CONTACT_SUBMISSION,
  submitContact,
  validateContact,
} from '../lib/contactValidation'
import type { ContactErrors, ContactField, ContactValues } from '../lib/contactValidation'

export type ContactFormProps = { endpoint?: string }

const LABELS: Record<ContactField, string> = {
  name: 'Name',
  email: 'Email',
  subject: 'Subject',
  message: 'Message',
}

export function ContactForm({ endpoint = CONTACT_SUBMISSION.endpoint }: ContactFormProps) {
  const id = useId()
  const [draft, setDraft] = useState<ContactValues>({ name: '', email: '', subject: '', message: '' })
  const [errors, setErrors] = useState<ContactErrors>({})
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const busy = useRef(false)
  const configured = Boolean(endpoint?.trim())

  function update(field: ContactField, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
    setStatus('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    const validation = validateContact(draft)
    setErrors(validation.errors)
    if (!validation.valid) {
      setStatus('Please correct the highlighted fields. Your draft remains here.')
      const first = CONTACT_FIELDS.find((field) => validation.errors[field])
      const input = first && event.currentTarget.elements.namedItem(first)
      if (input instanceof HTMLElement) input.focus()
      return
    }
    busy.current = true
    setLoading(true)
    setStatus(configured ? 'Submitting message…' : 'Validating message…')
    try {
      const result = await submitContact(draft, endpoint)
      if (result.state === 'invalid') setErrors(result.errors)
      setStatus(result.message)
      // Preserve the original draft, including on failure. Do not treat HTTP 200
      // alone as delivery, or erase a message the visitor may need to retry.
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  return (
    <form className="contact-form" aria-label="Contact message" aria-busy={loading} noValidate onSubmit={handleSubmit}>
      <p id={`${id}-help`} className="small-note">
        All fields are required. {configured
          ? 'Submitting sends this message to the configured submission service.'
          : 'Draft only — no submission service is configured. Validation does not send your message.'}
      </p>
      {CONTACT_FIELDS.map((field) => {
        const errorId = `${id}-${field}-error`
        const inputProps = {
          id: `${id}-${field}`,
          name: field,
          required: true,
          minLength: CONTACT_LIMITS[field].min,
          maxLength: CONTACT_LIMITS[field].max,
          disabled: loading,
          value: draft[field],
          'aria-invalid': Boolean(errors[field]),
          'aria-describedby': `${id}-help${errors[field] ? ` ${errorId}` : ''}`,
        }
        return (
          <div className="contact-field" key={field}>
            <label htmlFor={inputProps.id}>{LABELS[field]} (required)</label>
            {field === 'message'
              ? <textarea {...inputProps} rows={6} onChange={(event) => update(field, event.target.value)} />
              : <input {...inputProps} type={field === 'email' ? 'email' : 'text'} autoComplete={field === 'name' ? 'name' : field === 'email' ? 'email' : 'off'} onChange={(event) => update(field, event.target.value)} />}
            {errors[field] && <p className="contact-error" id={errorId}>{errors[field]}</p>}
          </div>
        )
      })}
      <button className="btn-mil" type="submit" disabled={loading}>
        {loading ? 'Please wait…' : configured ? 'Send message' : 'Validate message'}
      </button>
      <p className="contact-status" role="status" aria-live="polite" aria-atomic="true">{status}</p>
    </form>
  )
}
