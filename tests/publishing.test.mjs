import test from 'node:test'
import assert from 'node:assert/strict'
import { publishPullRequest, PublishError } from '../worker/src/publishing.mjs'
import { assetSignature, deploymentChanged, watchDeployment } from '../src/deployment.mjs'

const repo='DemoOrg/example-web'
const sha='e'.repeat(40)
const env={GITHUB_TOKEN:'fake-github',KIJAZO_REPO:repo}
const base = {
  number:12,state:'open',merged:false,draft:false,title:'Kijazo: make a new component',
  html_url:'https://github.com/DemoOrg/example-web/pull/12',
  head:{ref:'kijazo/1793836412478-0ec4cc01',sha,repo:{full_name:repo}},
  base:{ref:'main',repo:{full_name:repo}},
  mergeable:true,mergeable_state:'clean',
}
const check={check_runs:[{name:'Build / test',status:'completed',conclusion:'success'}]}

async function mocked(pr=base, checks=check){
  const calls=[]
  const old=globalThis.fetch
  globalThis.fetch=async (url, options={})=>{
    const path=String(url);calls.push({path,method:options.method||'GET',body:options.body});
    assert.equal(options.headers.Authorization,'Bearer fake-github')
    if(path.endsWith('/pulls/12'))return new Response(JSON.stringify(pr),{status:200})
    if(path.endsWith('/commits/'+sha+'/check-runs?per_page=100'))return new Response(JSON.stringify(checks),{status:200})
    if(path.endsWith('/pulls/12/merge'))return new Response(JSON.stringify({merged:true,sha:'f'.repeat(40)}),{status:200})
    throw Error('Unexpected GitHub request '+path)
  }
  return {calls,restore(){globalThis.fetch=old}}
}

const input={project:'example-web',prNumber:12,branch:base.head.ref}
test('owner-approved Kijazo PR with passing CI merges exactly its head SHA',async()=>{
  const fake=await mocked()
  try {
    const out=await publishPullRequest(env,input)
    assert.equal(out.ok,true)
    assert.equal(out.mergeCommit,'f'.repeat(40))
    assert.equal(fake.calls.filter(c=>c.method==='PUT').length,1)
    assert.equal(JSON.parse(fake.calls.find(c=>c.method==='PUT').body).sha,sha)
  }finally{fake.restore()}
})
test('cannot merge a non-Kijazo branch, even with passing CI',async()=>{
  const fake=await mocked({...base,head:{...base.head,ref:'feature/random'}})
  try {
    await assert.rejects(publishPullRequest(env,{...input,branch:'feature/random'}),e=>e instanceof PublishError&&e.status===403)
    assert.equal(fake.calls.filter(c=>c.method==='PUT').length,0)
  }finally{fake.restore()}
})
test('cannot merge a Kijazo PR targeted at another base branch',async()=>{
  const fake=await mocked({...base,base:{...base.base,ref:'development'}})
  try {
    await assert.rejects(publishPullRequest(env,input),e=>e instanceof PublishError&&e.status===403)
    assert.equal(fake.calls.filter(c=>c.method==='PUT').length,0)
  }finally{fake.restore()}
})
test('cannot merge when CI is pending or failing',async()=>{
  const fake=await mocked(base,{check_runs:[{name:'build',status:'in_progress',conclusion:null}]})
  try {
    await assert.rejects(publishPullRequest(env,input),e=>e instanceof PublishError&&e.status===409&&/build/.test(e.message))
    assert.equal(fake.calls.filter(c=>c.method==='PUT').length,0)
  }finally{fake.restore()}
})
test('cannot merge when no CI check exists',async()=>{
  const fake=await mocked(base,{check_runs:[]})
  try {
    await assert.rejects(publishPullRequest(env,input),e=>e instanceof PublishError&&e.status===409)
  }finally{fake.restore()}
})
test('cannot merge PRs that are unmergeable or awaiting review',async()=>{
  const fake=await mocked({...base,mergeable:false})
  try{
    await assert.rejects(publishPullRequest(env,input),e=>e instanceof PublishError&&e.status===409)
    assert.equal(fake.calls.filter(c=>c.method==='PUT').length,0)
  }finally{fake.restore()}
})
test('detects changed hashed assets for a same-page refresh',()=>{
  const old='<html><script type="module" crossorigin src="/assets/index-old.js"></script><link rel="modulepreload" href="/assets/WorldScene-old.js"></html>'
  const updated='<html><script type="module" crossorigin src="/assets/index-new.js"></script><link rel="modulepreload" href="/assets/WorldScene-new.js"></html>'
  assert.ok(assetSignature(old))
  assert.equal(deploymentChanged(old,updated),true)
  assert.equal(deploymentChanged(old,old),false)
})

test('deployment watcher refreshes only after a changed build is observable',async()=>{
  const old='<html><script type="module" src="/assets/index-old.js"></script></html>';
  const updated='<html><script type="module" src="/assets/index-new.js"></script></html>';
  let requests=0, refreshed=0;
  const done=await watchDeployment({
    pageUrl:'https://example.org/?kijazo=1',
    originalHtml:old,
    delayMs:0,maxAttempts:4,
    fetcher:async()=>{requests++;return {ok:true,text:async()=>requests<2?old:updated}},
    onReady:()=>{refreshed++}
  });
  assert.equal(done,true);
  assert.equal(refreshed,1);
  assert.equal(requests,2);
});
test('deployment watcher never claims success while assets are unchanged',async()=>{
  const old='<html><script type="module" src="/assets/index-old.js"></script></html>';
  let refreshed=0;
  const done=await watchDeployment({
    pageUrl:'https://example.org/?kijazo=1',
    originalHtml:old,delayMs:0,maxAttempts:2,
    fetcher:async()=>({ok:true,text:async()=>old}),
    onReady:()=>{refreshed++}
  });
  assert.equal(done,false);
  assert.equal(refreshed,0);
});
