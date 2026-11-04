// Kijazo API for Cloudflare Workers: GitHub-backed AI code editing.
// AI and GitHub credentials are server-only Cloudflare secrets.
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...headers}});
function cors(req,env) {
 const origin=req.headers.get('Origin')||'',allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim());
 return allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Content-Type,X-Kijazo-Editor-Key','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}:{};
}
function encode(content){const bytes=new TextEncoder().encode(content);let result='';for(let i=0;i<bytes.length;i++)result+=String.fromCharCode(bytes[i]);return btoa(result)}
function decode(content){const decoded=atob(content.replace(/\s/g,'')),bytes=new Uint8Array(decoded.length);for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);return new TextDecoder().decode(bytes)}
function github(env,path,options={}) {
 const url='https://api.github.com/repos/'+env.KIJAZO_REPO+path;
 return fetch(url,{...options,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Kijazo-Agent','Content-Type':'application/json',...(options.headers||{})}});
}
async function githubJSON(env,path,options={}){
 const res=await github(env,path,options);const data=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error('GitHub '+res.status+': '+String(data.message||'API error'));
 return data;
}
const toolSpecs=[
 {type:'function',function:{name:'list_files',description:'Find the files to modify in the existing repository',parameters:{type:'object',properties:{path:{type:'string',description:'Directory path, or empty string for repo root'}},required:['path'],additionalProperties:false}}},
 {type:'function',function:{name:'read_file',description:'Read a source file before modifying it',parameters:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}}},
 {type:'function',function:{name:'write_file',description:'Create or replace a source file with complete contents in the task branch',parameters:{type:'object',properties:{path:{type:'string'},content:{type:'string'}},required:['path','content'],additionalProperties:false}}}
];
function validPath(input){if(typeof input!=='string'||!input||input.length>300||input.startsWith('/')||input.includes('\\')||input.split('/').some(x=>x==='..'||x==='.'||!x))throw Error('Invalid repository path');return input}
function writable(path){validPath(path);if(/(^|\/)\.env($|[.\/])|(^|\/)\.github\/workflows\/|(^|\/)node_modules\/|(^|\/)\.git\/|(^|\/)package-lock\.json$/.test(path))throw Error('Protected path requires manual review: '+path)}
async function runAgent(env,input,emit) {
 const repo=env.KIJAZO_REPO;if(!/^[\w.-]+\/[\w.-]+$/.test(repo||''))throw Error('KIJAZO_REPO must be owner/repository');
 emit('status','Reading the application repository');
 const branch='kijazo/'+Date.now()+'-'+crypto.randomUUID().slice(0,8);
 const base=await githubJSON(env,'/git/ref/heads/main');
 await githubJSON(env,'/git/refs',{method:'POST',body:JSON.stringify({ref:'refs/heads/'+branch,sha:base.object.sha})});
 emit('status','Created an isolated Git branch: '+branch);
 let writes=0;const touched=[];
 const context=JSON.stringify({page:input.page||'',selected:input.selected||null}).slice(0,3500);
 const messages=[
  {role:'system',content:'You are Kijazo, an expert independent software coding agent. The user may request ANY frontend feature, redesign or behavior—do not restrict yourself to preset commands. You have access to repository tools. Inspect relevant files first, write real working production source, and preserve unrelated behavior. Prefer minimal changes and existing conventions. Work only on frontend and public content in this MVP. Do not claim to have run builds/tests; GitHub CI will run after your PR. Never insert secrets or depend on secrets in browser code. You can create/replace any permitted frontend file. Read before editing. Explain results precisely.'},
  {role:'user',content:'Project: '+repo+'\nContext: '+context+'\nInstruction: '+input.instruction}
 ];
 for(let round=0;round<18;round++){
  emit('status','Agent reasoning and editing — step '+(round+1));
  const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1-mini',messages,tools:toolSpecs,tool_choice:'auto',temperature:0.2})});
  if(!response.ok)throw Error('AI provider request failed ('+response.status+')');
  const output=await response.json();const choice=output.choices?.[0]?.message;
  if(!choice)throw Error('AI provider returned no message');
  messages.push(choice);
  if(!choice.tool_calls?.length){emit('status',choice.content||'Agent completed its changes');break}
  for(const call of choice.tool_calls){
   let result;
   try{
    const args=JSON.parse(call.function.arguments||'{}');
    switch(call.function.name){
      case 'list_files':{
        const dir=args.path?'/contents/'+validPath(args.path):'/contents/';
        const listing=await githubJSON(env,dir+'?ref='+encodeURIComponent(branch));
        result=Array.isArray(listing)?listing.map(x=>({name:x.name,path:x.path,type:x.type})).slice(0,200):{path:listing.path,type:listing.type};
        break;
      }
      case 'read_file':{
        const path=validPath(args.path);const file=await githubJSON(env,'/contents/'+path+'?ref='+encodeURIComponent(branch));
        if(file.size>180000)throw Error('File too large; split the task into smaller components');
        result={path,sha:file.sha,content:decode(file.content)};
        break;
      }
      case 'write_file':{
        const path=validPath(args.path);writable(path);
        if(typeof args.content!=='string'||args.content.length>150000)throw Error('Content must be UTF-8 text under 150 KB');
        if(writes>=12)throw Error('Task reached 12-file write budget');
        let sha;const old=await github(env,'/contents/'+path+'?ref='+encodeURIComponent(branch));
        if(old.ok)sha=(await old.json()).sha;else if(old.status!==404)throw Error('GitHub failed reading current file: '+old.status);
        await githubJSON(env,'/contents/'+path,{method:'PUT',body:JSON.stringify({message:'Kijazo: '+input.instruction.slice(0,65),content:encode(args.content),branch,...(sha?{sha}:{})})});
        writes++;if(!touched.includes(path))touched.push(path);
        emit('status','Edited '+path);result={ok:true,path};
        break;
      }
      default:throw Error('Unknown tool requested');
    }
   }catch(error){result={error:String(error.message||error)}}
   messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result).slice(0,190000)});
  }
 }
 if(!writes)throw Error('Agent did not produce any code changes. No pull request was opened.');
 emit('status','Opening a pull request for '+writes+' changes');
 const pr=await githubJSON(env,'/pulls',{method:'POST',body:JSON.stringify({
  title:'Kijazo: '+input.instruction.slice(0,90),
  head:branch,base:'main',
  body:'Automated Kijazo coding proposal.\n\n**Request:** '+input.instruction.slice(0,1500)+'\n\n**Files edited:**\n'+touched.map(x=>'- '+x).join('\n')+'\n\n**Checks:** Not executed by Cloudflare Worker. Review GitHub Actions results and the actual diff before merging.'
 })});
 return {prUrl:pr.html_url,message:'Kijazo proposed changes to '+touched.length+' file(s). Review the GitHub PR and its CI results before publishing.',branch};
}
export default {async fetch(request,env,ctx){
 const url=new URL(request.url),headers=cors(request,env);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(url.pathname==='/health')return json({ok:true,service:'kijazo-api'},200,headers);
 if(url.pathname!=='/api/changes'||request.method!=='POST')return json({error:'Not found'},404,headers);
 const origin=request.headers.get('Origin');
 if(origin&&!headers['Access-Control-Allow-Origin'])return json({error:'Origin not allowed'},403,headers);
 if(!env.KIJAZO_EDITOR_KEY||!env.OPENAI_API_KEY||!env.GITHUB_TOKEN)return json({error:'Server not configured; set required Cloudflare secrets'},503,headers);
 const sent=request.headers.get('X-Kijazo-Editor-Key')||'';
 if(!sent||sent!==env.KIJAZO_EDITOR_KEY)return json({error:'Editor authorization required'},401,headers);
 let input;try{input=await request.json()}catch{return json({error:'Invalid JSON'},400,headers)}
 if(typeof input.instruction!=='string'||input.instruction.length<3||input.instruction.length>5000)return json({error:'Instruction must be 3-5000 characters'},400,headers);
 const stream=new ReadableStream({start(controller){
  const encoder=new TextEncoder();
  const emit=(type,message)=>controller.enqueue(encoder.encode('data: '+JSON.stringify({type,message})+'\n\n'));
  ctx.waitUntil((async()=>{try{
    const outcome=await runAgent(env,input,emit);
    controller.enqueue(encoder.encode('data: '+JSON.stringify({type:'complete',...outcome})+'\n\n'));
   }catch(error){emit('error',String(error.message||error))}finally{controller.close()}})());
 }});
 return new Response(stream,{headers:{...headers,'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff'}});
}};
