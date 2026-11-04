import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../worker/src/index.mjs'

const env = {
  KIJAZO_EDITOR_KEY: 'test-editor',
  OPENAI_API_KEY: 'test-openai',
  GITHUB_TOKEN: 'test-github',
  KIJAZO_REPO: 'M-Waweru/worldmwaweru',
  ALLOWED_ORIGINS: 'https://mwaweru.com',
}
const request = key => new Request('https://api.kijazo.test/api/diagnostics', {
  method:'POST', headers:{'x-kijazo-editor-key':key,Origin:'https://mwaweru.com'}
})

test('GitHub diagnostics deny requests without editor authorization', async () => {
  const result = await worker.fetch(request('wrong'), env, {waitUntil() {}})
  assert.equal(result.status,401)
})

test('GitHub diagnostics report readable main branch without revealing token', async () => {
  const prior=globalThis.fetch
  globalThis.fetch=async (url, init) => {
    assert.match(String(url),/\/repos\/M-Waweru\/worldmwaweru\/git\/ref\/heads\/main$/)
    assert.equal(init.headers.Authorization,'Bearer test-github')
    return new Response(JSON.stringify({object:{sha:'abc123'}}),{status:200})
  }
  try {
    const result=await worker.fetch(request('test-editor'),env,{waitUntil(){}})
    assert.equal(result.status,200)
    const body=await result.json()
    assert.equal(body.ok,true)
    assert.equal(body.main_ref_accessible,true)
    assert.equal(JSON.stringify(body).includes('test-github'),false)
  } finally {globalThis.fetch=prior}
})

test('GitHub diagnostics explain 404 without leaking credentials', async () => {
  const prior=globalThis.fetch
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'Not Found'}),{status:404})
  try {
    const result=await worker.fetch(request('test-editor'),env,{waitUntil(){}})
    const body=await result.json()
    assert.equal(body.ok,false)
    assert.match(body.error,/GitHub 404.*token may lack access/)
    assert.equal(JSON.stringify(body).includes('test-github'),false)
  } finally {globalThis.fetch=prior}
})
