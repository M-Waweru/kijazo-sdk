import test from 'node:test'
import assert from 'node:assert/strict'
import { discoverApplication } from '../src/discovery.mjs'

test('discovers React/Vite and Netlify, but does not guess protected branches', () => {
  const out=discoverApplication({
    repository:'Demo/world',
    paths:['package.json','vite.config.ts','netlify.toml','src/App.tsx'],
    files:{'package.json':JSON.stringify({name:'world',scripts:{build:'tsc && vite build',test:'vitest run'},dependencies:{react:'^19',vite:'^7'}})},
    branches:['main','staging','feature/new'],
  })
  assert.equal(out.manifest.detected.frontend[0].framework,'react-vite')
  assert.equal(out.manifest.detected.hosting[0].framework,'netlify')
  assert.deepEqual(out.branchSuggestions,['main','staging'])
  assert.equal(out.manifest.environments.production.branch,null)
  assert.equal(out.manifest.environments.staging.branch,null)
  assert.equal(out.manifest.integration.status,'not-installed')
  assert.equal(out.manifest.checks.build,'npm run build')
})

test('detects Django API and preserves an explicit review gate', () => {
  const out=discoverApplication({
    repository:'Demo/api',
    paths:['manage.py','requirements.txt','Dockerfile'],
    files:{'requirements.txt':'Django==5.2\ncelery'},
  })
  assert.equal(out.manifest.detected.backend[0].framework,'django')
  assert.equal(out.manifest.detected.hosting[0].framework,'docker')
  assert.equal(out.manifest.integration.mode,'server-side')
  assert.equal(out.manifest.reviewRequired,true)
})

test('an unfamiliar repository never guesses deployment settings or writes anything', () => {
  const out=discoverApplication({repository:'Demo/unknown',paths:['README.md'],branches:['master']})
  assert.equal(out.manifest.environments.production.url,null)
  assert.equal(out.manifest.environments.production.branch,null)
  assert.ok(out.warnings.some(x=>x.includes('Hosting provider not detected')))
})
