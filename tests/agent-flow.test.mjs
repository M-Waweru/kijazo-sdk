import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../worker/src/index.mjs'

const env = { KIJAZO_EDITOR_KEY: 'editor-test-key', OPENAI_API_KEY: 'openai-test-key', GITHUB_TOKEN: 'github-test-key', KIJAZO_REPO: 'TestOrg/test-web', OPENAI_MODEL: 'gpt-4.1-mini', ALLOWED_ORIGINS: 'https://example.com' }
const response = (value, status=200) => new Response(JSON.stringify(value), {status,headers:{'content-type':'application/json'}})
function mockFetch(calls) {
 let modelCalls=0
 return async (url, options={}) => {
  const target=String(url)
  calls.push({target,method:options.method||'GET'})
  if(target==='https://api.openai.com/v1/chat/completions') {
    modelCalls++
    const input=JSON.parse(options.body)
    const userMessage=input.messages.find(m=>m.role==='user')
    assert.equal(typeof userMessage.content,'string','Text-only requests must not be multimodal')
    if(modelCalls===1) return response({choices:[{message:{role:'assistant',tool_calls:[{id:'write-1',type:'function',function:{name:'write_file',arguments:JSON.stringify({path:'src/title.ts',content:'export const title = "Hello";\n'})}}]}}]})
    return response({choices:[{message:{role:'assistant',content:'Updated the title.'}}]})
  }
  if(target.endsWith('/git/ref/heads/main'))return response({object:{sha:'basecommit'}})
  if(target.endsWith('/git/refs')&&options.method==='POST')return response({ref:'refs/heads/kijazo/test'})
  if(target.includes('/contents/src/title.ts')&&(!options.method||options.method==='GET'))return response({message:'Not found'},404)
  if(target.includes('/contents/src/title.ts')&&options.method==='PUT')return response({content:{path:'src/title.ts'}})
  if(target.endsWith('/pulls')&&options.method==='POST')return response({html_url:'https://github.com/TestOrg/test-web/pull/1'})
  throw new Error('Unexpected mock request '+target+' ('+(options.method||'GET')+')')
 }
}
async function runTextOnly(imageMode) {
 const previous=globalThis.fetch
 const calls=[]
 globalThis.fetch=mockFetch(calls)
 try {
  const body={instruction:'Change the title to Hello',project:'test-web',page:'https://example.com/'}
  if(imageMode!=='omitted')body.image=imageMode
  const pending=[]
  const result=await worker.fetch(new Request('https://api.kijazo.test/api/changes',{
    method:'POST',headers:{'content-type':'application/json','x-kijazo-editor-key':env.KIJAZO_EDITOR_KEY,Origin:'https://example.com'},
    body:JSON.stringify(body)
  }),env,{waitUntil(p){pending.push(p)}})
  assert.equal(result.status,200)
  const output=await result.text()
  await Promise.all(pending)
  const events=output.split('\n\n').filter(x=>x.startsWith('data: ')).map(x=>JSON.parse(x.slice(6)))
  assert.equal(events.at(-1)?.type,'complete',JSON.stringify(events))
  assert.equal(events.at(-1)?.prUrl,'https://github.com/TestOrg/test-web/pull/1')
  assert.ok(calls.some(x=>x.target.endsWith('/pulls')&&x.method==='POST'))
 }finally{globalThis.fetch=previous}
}
test('text-only request with image omitted reaches agent and opens pull request',async()=>runTextOnly('omitted'))
test('text-only request with image null is backward compatible and opens pull request',async()=>runTextOnly(null))
test('bad image type returns useful 400',async()=>{
 const result=await worker.fetch(new Request('https://api.kijazo.test/api/changes',{
   method:'POST',headers:{'content-type':'application/json','x-kijazo-editor-key':env.KIJAZO_EDITOR_KEY,Origin:'https://example.com'},
   body:JSON.stringify({project:'test-web',instruction:'Change this',image:'data:image/svg+xml;base64,PHN2Zz4='})
 }),env,{waitUntil(){}})
 assert.equal(result.status,400)
 assert.match((await result.json()).error,/PNG|JPEG|WebP/)
})

test('PDF reference is validated and accepted into agent stream',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{
  const str=String(url);
  if(str.endsWith('/git/ref/heads/main'))return response({object:{sha:'base'}});
  if(str.endsWith('/git/refs')&&options.method==='POST')return response({ref:'refs/heads/kijazo/test'});
  if(str.includes('api.openai.com/v1/chat/completions')){
    const messages=JSON.parse(options.body).messages;
    const user=messages.find(x=>x.role==='user');
    assert.ok(user.content.some(x=>x.type==='file'&&x.file.filename==='brief.pdf'));
    return response({choices:[{message:{role:'assistant',content:'Reviewed the PDF, no code changes required.'}}]});
  }
  throw Error('unexpected test request: '+str);
 };
 try{
  const tasks=[];
  const result=await worker.fetch(new Request('https://api.kijazo.test/api/changes',{
   method:'POST',headers:{'content-type':'application/json','x-kijazo-editor-key':env.KIJAZO_EDITOR_KEY,Origin:'https://example.com'},
   body:JSON.stringify({instruction:'Use this PDF as the design reference',project:'test-web',document:{name:'brief.pdf',type:'application/pdf',data:'data:application/pdf;base64,JVBERi0xLjQ='}})
  }),env,{waitUntil(p){tasks.push(p)}});
  assert.equal(result.status,200);
  const events=await result.text();
  await Promise.all(tasks);
  assert.match(events,/Agent did not produce any code changes/);
  assert.doesNotMatch(events,/Unsupported document type/);
 }finally{globalThis.fetch=original}
});
