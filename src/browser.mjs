import { captureScreen, imageFromFile, createAnnotator } from './capture.mjs'
import { editorCss } from './styles.mjs'

const elt=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node}
const isEditorOn = config=>config.enableWhen==='always'||(config.enableWhen!=='never'&&new URLSearchParams(location.search).has('kijazo'));
const stripUrl = value => {try{const parsed=new URL(value);return parsed.origin+parsed.pathname+parsed.hash}catch{return ''}}
function elSelector(target){
 const id=target.id?'#'+CSS.escape(target.id):'';
 const classes=!id?[...target.classList].slice(0,3).map(c=>'.'+CSS.escape(c)).join(''):'';
 return target.tagName.toLowerCase()+id+classes;
}
function parseSse(block){
 const match=block.split('\n').filter(line=>line.startsWith('data: ')).map(line=>line.slice(6)).join('\n');
 if(!match)return null;
 try{return JSON.parse(match)}catch{return null}
}
export function mountKijazo(config={}){
 const opt={title:'Kijazo',project:'',enableWhen:'query-param',apiUrl:'',...config};
 if(!isEditorOn(opt))return {open(){},close(){},destroy(){}};
 if(!document.body)throw Error('Kijazo requires a mounted document body');
 const host=elt('div');host.dataset.kijazoRoot='';
 const shadow=host.attachShadow({mode:'open'});
 const style=elt('style',editorCss);shadow.append(style);document.body.append(host);
 const launcher=elt('button','✦  Edit with Kijazo');launcher.className='kj-launch';launcher.type='button';shadow.append(launcher);
 const panel=elt('section');panel.className='kj-panel';panel.hidden=true;panel.setAttribute('aria-label','Kijazo AI editor');shadow.append(panel);
 const head=elt('header');head.className='kj-head';const name=elt('div');name.append(elt('div',opt.title),elt('div','Build inside any application'));name.firstChild.className='kj-head-title';name.lastChild.className='kj-subtitle';const exit=elt('button','×');exit.type='button';exit.setAttribute('aria-label','Close editor');head.append(name,exit);panel.append(head);
 const thread=elt('div');thread.className='kj-thread';thread.setAttribute('role','log');thread.setAttribute('aria-live','polite');panel.append(thread);
 const status=elt('div');status.className='kj-progress';status.hidden=true;thread.append(status);
 const composer=elt('div');composer.className='kj-composer';panel.append(composer);
 const controls=elt('div');controls.className='kj-context';
 const select=elt('button','◎ Select');const screen=elt('button','▣ Capture');const attach=elt('button','＋ Image');const annotate=elt('button','✎ Mark up');const fresh=elt('button','↻ New');
 for(const b of [select,screen,attach,annotate,fresh])b.type='button';
 controls.append(select,screen,attach,annotate,fresh);composer.append(controls);
 const attachment=elt('div');attachment.className='kj-attach';attachment.hidden=true;const thumb=elt('img');thumb.alt='Screenshot to send to Kijazo';const attachLabel=elt('span','Screenshot attached');const detach=elt('button','✕');detach.setAttribute('aria-label','Remove screenshot');attachment.append(thumb,attachLabel,detach);composer.append(attachment);
 const row=elt('div');row.className='kj-compose-row';const prompt=elt('textarea');prompt.className='kj-input';prompt.placeholder='Tell Kijazo what to build or change…';prompt.setAttribute('aria-label','Message to Kijazo');prompt.rows=2;const send=elt('button','Send ↗');send.className='kj-send';send.type='button';row.append(prompt,send);composer.append(row);
 const foot=elt('div');foot.className='kj-foot';const hint=elt('span','Enter to send · Shift+Enter for newline');const setup=elt('button','Connect editor');foot.append(hint,setup);composer.append(foot);
 const file=elt('input');file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif';file.hidden=true;shadow.append(file);
 const overlay=elt('div');overlay.className='kj-annotation';overlay.hidden=true;const work=elt('div');work.className='kj-annotation-body';const overlayHead=elt('header');overlayHead.append(elt('h2','Mark the area you want changed'));const closeOverlay=elt('button','Cancel');overlayHead.append(closeOverlay);work.append(overlayHead);
 const tools=elt('div');tools.className='kj-tools';const buttons={};
 for(const [key,label] of [['pen','Draw'],['highlight','Highlight'],['circle','Circle'],['arrow','Arrow'],['crop','Crop']]){const b=elt('button',label);b.type='button';b.dataset.tool=key;buttons[key]=b;tools.append(b)}
 const undo=elt('button','Undo');const clear=elt('button','Clear');tools.append(undo,clear);work.append(tools);
 const canvas=elt('canvas');canvas.setAttribute('aria-label','Screenshot drawing area');work.append(canvas);
 const overlayActions=elt('div');overlayActions.className='kj-annotation-actions';const done=elt('button','Attach marked image');done.className='kj-apply';overlayActions.append(done);work.append(overlayActions);overlay.append(work);shadow.append(overlay);
 const annotator=createAnnotator(canvas);
 let screenshot=null,selection=null,selecting=false,busy=false,secret='',sessionId=crypto.randomUUID(),branch=null,lastPr=null,destroyed=false;
 const threadHistory=[];
 function log(role,text,image){
  const msg=elt('div');msg.className='kj-message';msg.dataset.role=role;msg.append(elt('small',role==='you'?'You':'Kijazo'));msg.append(document.createTextNode(String(text||'')));
  if(image){const pic=elt('img');pic.alt='Attached screenshot';pic.src=image;msg.append(pic)}
  thread.insertBefore(msg,status);
  thread.scrollTop=thread.scrollHeight;
  return msg;
 }
 function addLink(message,url){
  const msg=log('kijazo',message+' ');
  const a=elt('a','Review pull request');a.href=url;a.target='_blank';a.rel='noopener noreferrer';msg.append(a);
 }
 function updateImage(next){
  screenshot=next;
  attachment.hidden=!next;
  if(next)thumb.src=next;else thumb.removeAttribute('src');
  annotate.disabled=!next;
 }
 annotate.disabled=true;
 function stopSelect(){selecting=false;select.setAttribute('aria-pressed','false');document.querySelectorAll('.kj-selection-highlight').forEach(n=>n.classList.remove('kj-selection-highlight'))}
 function selectCapture(event){
  if(!selecting||!(event.target instanceof Element)||event.composedPath().includes(host))return;
  event.preventDefault();event.stopImmediatePropagation();
  const target=event.target;
  selection={selector:elSelector(target),text:(target.textContent||'').trim().slice(0,700),html:target.outerHTML.slice(0,2800),bounds:(()=>{const r=target.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}})()};
  stopSelect();log('kijazo','Selected '+selection.selector+'. Tell me how you want it changed.');
 }
 document.addEventListener('click',selectCapture,true);
 function open(){launcher.hidden=true;panel.hidden=false;prompt.focus()}
 function close(){panel.hidden=true;launcher.hidden=false;stopSelect()}
 launcher.addEventListener('click',open);exit.addEventListener('click',close);
 select.addEventListener('click',()=>{selecting=!selecting;select.setAttribute('aria-pressed',String(selecting));log('kijazo',selecting?'Click an element in the application to give me its context.':'Selection cancelled.')});
 file.addEventListener('change',async()=>{if(!file.files?.[0])return;try{updateImage(await imageFromFile(file.files[0]));log('kijazo','Image attached. Add a note or mark it up.')}catch(e){log('kijazo',e.message)}finally{file.value=''}});
 attach.addEventListener('click',()=>file.click());detach.addEventListener('click',()=>updateImage(null));
 screen.addEventListener('click',async()=>{try{const wasVisible=!panel.hidden;panel.hidden=true;const picture=await captureScreen();panel.hidden=!wasVisible;updateImage(picture);log('kijazo','Captured your selected tab or screen. You can circle or highlight what should change.')}catch(e){panel.hidden=false;log('kijazo',e.message)}});
 annotate.addEventListener('click',async()=>{if(!screenshot)return;overlay.hidden=false;await annotator.load(screenshot);buttons.pen.setAttribute('aria-pressed','true')});
 for(const [name,b] of Object.entries(buttons))b.addEventListener('click',()=>{annotator.setTool(name);Object.entries(buttons).forEach(([key,element])=>element.setAttribute('aria-pressed',String(key===name)))});
 undo.addEventListener('click',()=>annotator.undo());clear.addEventListener('click',()=>annotator.clear());
 done.addEventListener('click',()=>{updateImage(annotator.screenshot());overlay.hidden=true;log('kijazo','Marked screenshot ready to send.')});
 closeOverlay.addEventListener('click',()=>{overlay.hidden=true});
 shadow.addEventListener('paste',async event=>{
  const images=[...(event.clipboardData?.items||[])].filter(item=>item.type.startsWith('image/'));
  if(!images.length)return;
  const uploaded=images[0].getAsFile();if(!uploaded)return;
  event.preventDefault();
  try{updateImage(await imageFromFile(uploaded));log('kijazo','Pasted screenshot attached.')}catch(e){log('kijazo',e.message)}
 });
 setup.addEventListener('click',()=>{
  if(!secret){const proposed=window.prompt('Enter your Kijazo editor key. This is kept only in browser memory.');if(proposed)secret=proposed.trim()}
  else if(window.confirm('Clear the editor access key from memory?'))secret='';
  setup.textContent=secret?'Editor connected · change key':'Connect editor';
 });
 fresh.addEventListener('click',()=>{sessionId=crypto.randomUUID();branch=null;lastPr=null;selection=null;updateImage(null);threadHistory.length=0;log('kijazo','Started a fresh editing session.')});
 async function submit(){
  const instruction=prompt.value.trim();
  if(!instruction && !screenshot)return;
  if(!opt.apiUrl){log('kijazo','The Kijazo API is not configured on this application. Ask its owner to set the API URL.');return}
  if(!secret){log('kijazo','Use Connect editor to enter your access key before sending AI requests.');return}
  if(busy)return;
  busy=true;send.disabled=true;status.hidden=false;status.textContent='Connecting to Kijazo…';
  const image=screenshot;
  log('you',instruction||(image?'Please inspect this screenshot and make the indicated change.':''),image);
  prompt.value='';
  try{
   const response=await fetch(opt.apiUrl.replace(/\/$/,'')+'/api/changes',{method:'POST',headers:{'content-type':'application/json','X-Kijazo-Editor-Key':secret},body:JSON.stringify({
    project:opt.project||'',page:stripUrl(location.href),instruction:instruction||'Please inspect the screenshot and implement the indicated improvements.',selected:selection,image,sessionId,branch,history:threadHistory.slice(-8),
   })});
   if(!response.ok){let data;try{data=await response.json()}catch{}throw Error(data?.error||'Kijazo API returned '+response.status)}
   if(!response.body)throw Error('Streaming responses are unavailable');
   const reader=response.body.getReader(),decoder=new TextDecoder();let remaining='',complete=null,error=null;
   for(;;){const {done,value}=await reader.read();if(done)break;remaining+=decoder.decode(value,{stream:true});const chunks=remaining.split(/\r?\n\r?\n/);remaining=chunks.pop()||'';
     for(const chunk of chunks){const event=parseSse(chunk);if(!event)continue;
       if(event.type==='status')status.textContent=event.message;
       if(event.type==='complete')complete=event;
       if(event.type==='error')error=event.message||'Agent request failed';
     }
   }
   if(error)throw Error(error);
   if(!complete)throw Error('The agent connection closed before reporting a result.');
   if(complete.branch)branch=complete.branch;
   if(complete.prUrl){lastPr=complete.prUrl;addLink(complete.message||'Changes proposed.',complete.prUrl)}
   else log('kijazo',complete.message||'Request completed.');
   threadHistory.push({role:'user',content:instruction},{role:'assistant',content:complete.message||'Prepared code edits'});
   status.textContent='Changes ready for review.';
   updateImage(null);selection=null;
  }catch(error){log('kijazo',error.message||String(error));status.textContent='Request failed — please retry.'}
  finally{busy=false;send.disabled=false;setTimeout(()=>{if(!busy)status.hidden=true},1600)}
 }
 send.addEventListener('click',()=>void submit());
 prompt.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void submit()}});
 log('kijazo','Tell me what you want to build. Select a component or attach a screenshot and draw on it to show me exactly where.');
 return {open,close,destroy(){if(destroyed)return;destroyed=true;stopSelect();annotator.destroy();document.removeEventListener('click',selectCapture,true);host.remove()}};
}
