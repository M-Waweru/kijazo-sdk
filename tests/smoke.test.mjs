import test from 'node:test'
import assert from 'node:assert/strict'
import { mountKijazo } from '../src/browser.mjs'
import worker from '../worker/src/index.mjs'

test('exports embeddable browser SDK', () => {
  assert.equal(typeof mountKijazo, 'function')
})

test('worker provides a health endpoint without credentials', async () => {
  const response = await worker.fetch(new Request('https://api.kijazo.com/health'), {}, { waitUntil() {} })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, service: 'kijazo-api' })
})

test('agent endpoint fails closed if secrets are missing', async () => {
  const request = new Request('https://api.kijazo.com/api/changes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ instruction: 'Change the heading to Hello Kijazo' }),
  })
  const response = await worker.fetch(request, { ALLOWED_ORIGINS: '' }, { waitUntil() {} })
  assert.equal(response.status, 503)
})

test('API rejects invalid screenshot data before invoking AI', async () => {
  const response = await worker.fetch(new Request('https://api.kijazo.com/api/changes', {
    method: 'POST', headers: {'content-type':'application/json','x-kijazo-editor-key':'test-key'},
    body:JSON.stringify({instruction:'Change this card',image:'data:image/svg+xml;base64,abc'}),
  }), {KIJAZO_EDITOR_KEY:'test-key',OPENAI_API_KEY:'fake',GITHUB_TOKEN:'fake',KIJAZO_REPO:'example/app'}, {waitUntil(){}});
  assert.equal(response.status,400);
});
test('API rejects invalid branch selectors', async () => {
  const response = await worker.fetch(new Request('https://api.kijazo.com/api/changes', {
    method:'POST', headers:{'content-type':'application/json','x-kijazo-editor-key':'test-key'},
    body:JSON.stringify({instruction:'Edit this button',branch:'main'}),
  }), {KIJAZO_EDITOR_KEY:'test-key',OPENAI_API_KEY:'fake',GITHUB_TOKEN:'fake',KIJAZO_REPO:'example/app'}, {waitUntil(){}});
  assert.equal(response.status,400);
});
