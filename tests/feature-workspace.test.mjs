import test from 'node:test'
import assert from 'node:assert/strict'
import { createFeatureWorkspace, workspaceNamespace, transitionWorkspace, featureSummary } from '../src/feature-workspace.mjs'

const options=(featureId)=>({
  projectId:'thenks-impact',featureId,
  title:'Campaign donation dashboard',requestedBy:'engineering-user',
  baseRefs:{frontend:'f'.repeat(40),backend:'b'.repeat(40)},
  services:[
    {name:'frontend',internalPort:3000},
    {name:'backend',internalPort:8000},
    {name:'database',internalPort:5432}
  ]
})
test('two workspaces have separate namespaces even if every service port is identical',()=>{
  const a=createFeatureWorkspace(options('campaign-progress-001'))
  const b=createFeatureWorkspace(options('recurring-donations-002'))
  assert.notEqual(a.namespace,b.namespace)
  assert.deepEqual(a.services.map(x=>x.internalPort),b.services.map(x=>x.internalPort))
  assert.equal(a.preview.url,null)
  assert.equal(b.preview.url,null)
  assert.equal(a.database.productionConnectionAllowed,false)
  assert.equal(workspaceNamespace('thenks-impact','campaign-progress-001'),a.namespace)
})
test('isolated workspace cannot assume a production URL or database',()=>{
  const w=createFeatureWorkspace(options('campaign-progress-001'))
  assert.equal(w.state,'requested')
  assert.equal(w.database.mode,'isolated-test-data')
  assert.equal(w.services[0].previewUrl,null)
  assert.deepEqual(w.git.pullRequests,[])
})
test('feature states require explicit actor and prevent skipping preview and review',()=>{
  let w=createFeatureWorkspace(options('campaign-progress-001'))
  assert.throws(()=>transitionWorkspace(w,'live',{actor:'user'}),/Invalid transition/)
  assert.throws(()=>transitionWorkspace(w,'queued'),/actor/)
  w=transitionWorkspace(w,'queued',{actor:'user'})
  w=transitionWorkspace(w,'provisioning',{actor:'orchestrator'})
  w=transitionWorkspace(w,'building',{actor:'coding-agent'})
  w=transitionWorkspace(w,'testing',{actor:'test-runner'})
  w=transitionWorkspace(w,'preview_ready',{actor:'preview-check'})
  assert.equal(featureSummary(w).previewReady,true)
  w=transitionWorkspace(w,'review_requested',{actor:'user'})
  w=transitionWorkspace(w,'approved',{actor:'reviewer'})
  w=transitionWorkspace(w,'publishing',{actor:'publisher'})
  w=transitionWorkspace(w,'live',{actor:'deploy-monitor'})
  assert.equal(w.state,'live')
})
test('invalid names or duplicate services are rejected before resources are provisioned',()=>{
  assert.throws(()=>createFeatureWorkspace(options('../bad')),/featureId/)
  const x=options('valid-001');x.services.push({name:'frontend',internalPort:9000})
  assert.throws(()=>createFeatureWorkspace(x),/unique/)
})
