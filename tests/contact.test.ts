import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ContactForm } from '../src/ui/ContactForm'
import {
  CONTACT_FIELDS,
  CONTACT_LIMITS,
  CONTACT_SUBMISSION,
  UNCONFIGURED_CONTACT_MESSAGE,
  resolveContactEndpoint,
  submitContact,
  validateContact,
} from '../src/lib/contactValidation'
import type { ContactValues } from '../src/lib/contactValidation'

const draft: ContactValues = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Project enquiry',
  message: 'I would like to discuss a project.',
}

function mockFetch(response: Response | Error, inspect?: (input: RequestInfo | URL, init?: RequestInit) => void): typeof fetch {
  return async (input, init) => {
    inspect?.(input, init)
    if (response instanceof Error) throw response
    return response
  }
}

const neverFetch: typeof fetch = async () => { throw new Error('Unexpected network request') }

test('valid contact values are trimmed without mutating the draft', () => {
  const padded = Object.fromEntries(CONTACT_FIELDS.map((field) => [field, ` \n${draft[field]}\t `])) as ContactValues
  const before = { ...padded }
  const result = validateContact(padded)
  assert.equal(result.valid, true)
  assert.deepEqual(result.values, draft)
  assert.deepEqual(result.errors, {})
  assert.deepEqual(padded, before)
})

test('empty and whitespace-only fields are all required', () => {
  for (const value of ['', ' \t\n ']) {
    const result = validateContact({ name: value, email: value, subject: value, message: value })
    assert.equal(result.valid, false)
    for (const field of CONTACT_FIELDS) assert.match(result.errors[field]!, /required/)
  }
})

test('length boundaries apply after trimming', () => {
  for (const field of ['name', 'subject', 'message'] as const) {
    const { min, max } = CONTACT_LIMITS[field]
    assert.equal(validateContact({ ...draft, [field]: ` ${'x'.repeat(min)} ` }).valid, true)
    assert.equal(validateContact({ ...draft, [field]: 'x'.repeat(max) }).valid, true)
    assert.match(validateContact({ ...draft, [field]: 'x'.repeat(min - 1) }).errors[field]!, /at least/)
    assert.match(validateContact({ ...draft, [field]: 'x'.repeat(max + 1) }).errors[field]!, /no more/)
  }
  assert.equal(validateContact({ ...draft, email: `${'a'.repeat(242)}@example.com` }).valid, true)
  assert.match(validateContact({ ...draft, email: `${'a'.repeat(243)}@example.com` }).errors.email!, /no more/)
})

test('email validation accepts ordinary addresses and rejects malformed ones', () => {
  for (const email of ['ada@example.com', 'ada+project@example.co.uk']) {
    assert.equal(validateContact({ ...draft, email }).valid, true)
  }
  for (const email of ['ada', 'ada@', '@example.com', 'ada@example', 'ada @example.com', 'ada@@example.com']) {
    assert.equal(validateContact({ ...draft, email }).errors.email, 'Enter a valid email address.')
  }
})

test('endpoint remains unset and valid or invalid default submissions make zero requests', async () => {
  assert.equal(CONTACT_SUBMISSION.endpoint, undefined)
  let calls = 0
  const fetcher: typeof fetch = async () => { calls++; throw new Error('Unexpected network request') }
  const result = await submitContact(draft, undefined, fetcher)
  assert.deepEqual(result, { state: 'unconfigured', message: UNCONFIGURED_CONTACT_MESSAGE })
  const invalid = await submitContact({ ...draft, name: '' }, undefined, fetcher)
  assert.equal(invalid.state, 'invalid')
  assert.equal(calls, 0)
})

test('endpoint policy allows explicit HTTPS and local API paths only', async () => {
  assert.equal(resolveContactEndpoint('/api/contact'), '/api/contact')
  assert.equal(resolveContactEndpoint('/api/contact?source=portfolio'), '/api/contact?source=portfolio')
  assert.equal(resolveContactEndpoint('https://example.com/contact'), 'https://example.com/contact')
  for (const endpoint of ['//example.com/api/contact', '/contact', '/api/../contact', '/api/../../contact', 'http://example.com/contact', 'javascript:alert(1)', 'https://user:secret@example.com/contact', '/api/contact#fragment', '/api/\\example.com', 'invalid']) {
    assert.equal(resolveContactEndpoint(endpoint), undefined, endpoint)
    let calls = 0
    const result = await submitContact(draft, endpoint, mockFetch(new Response('{}'), () => { calls++ }))
    assert.equal(result.state, 'error', endpoint)
    assert.equal(calls, 0, endpoint)
  }
})

test('submission posts only normalized contact fields and requires acknowledgement', async () => {
  let calls = 0
  const original = { ...draft, message: `  ${draft.message}  ` }
  const result = await submitContact(original, '/api/contact', mockFetch(new Response('{"success":true}', { status: 200 }), (input, init) => {
    calls++
    assert.equal(input, '/api/contact')
    assert.equal(init?.method, 'POST')
    assert.deepEqual(JSON.parse(init?.body as string), draft)
    assert.deepEqual(init?.headers, { 'Content-Type': 'application/json', Accept: 'application/json' })
    assert.equal(init?.credentials, 'same-origin')
    assert.equal(init?.redirect, 'error')
  }))
  assert.equal(calls, 1)
  assert.equal(result.state, 'success')
  assert.match(result.message, /acknowledged receipt/)
  assert.equal(original.message, `  ${draft.message}  `)
})

test('HTTP 200 without success:true never claims success; errors preserve input', async () => {
  const original = { ...draft }
  for (const body of ['{}', '{"success":false}', '{"success":"true"}', 'null', 'true', '[]', '<html>OK</html>', '']) {
    const result = await submitContact(draft, '/api/contact', mockFetch(new Response(body, { status: 200 })))
    assert.equal(result.state, 'error', body)
    assert.match(result.message, /Delivery not confirmed/)
  }
  for (const response of [new Response('{"success":true}', { status: 500 }), new Response(null, { status: 204 }), new Error('offline')]) {
    const result = await submitContact(draft, '/api/contact', mockFetch(response))
    assert.equal(result.state, 'error')
    assert.match(result.message, /draft remains here/)
  }
  const invalid = await submitContact({ ...draft, email: 'bad' }, '/api/contact', neverFetch)
  assert.equal(invalid.state, 'invalid')
  assert.deepEqual(draft, original)
})

test('default form is labelled, accessible, honest and has an enabled validation button', () => {
  const html = renderToStaticMarkup(createElement(ContactForm))
  assert.match(html, /aria-label="Contact message"/)
  assert.match(html, /no submission service is configured/)
  assert.match(html, /Validation does not send your message/)
  assert.match(html, /<button[^>]*type="submit"[^>]*>Validate message<\/button>/)
  assert.doesNotMatch(html, /disabled=""/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /aria-describedby=/)
  for (const field of CONTACT_FIELDS) {
    assert.match(html, new RegExp(`name="${field}"`))
  }
  assert.equal((html.match(/<label /g) ?? []).length, 4)
  assert.doesNotMatch(html, /birth|dob/i)
  const configured = renderToStaticMarkup(createElement(ContactForm, { endpoint: '/api/contact' }))
  assert.match(configured, />Send message<\/button>/)
})
