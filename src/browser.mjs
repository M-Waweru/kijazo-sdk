/* Kijazo SDK: standalone browser layer. AI keys are never embedded in frontend code. */
const CSS = ".kj-trigger{position:fixed;z-index:2147483000;bottom:18px;right:18px;background:#183a2c;color:white;border:0;border-radius:40px;padding:13px 19px;font:600 14px system-ui;box-shadow:0 8px 24px #15342766;cursor:pointer}.kj-panel{position:fixed;z-index:2147483000;right:15px;bottom:15px;width:min(390px,calc(100vw - 30px));height:min(700px,calc(100dvh - 30px));background:#f9faf5;color:#183a2c;border-radius:16px;box-shadow:0 14px 50px #152e2966;font:13px system-ui;display:flex;flex-direction:column;overflow:hidden}.kj-panel[hidden],.kj-trigger[hidden]{display:none}.kj-panel *{box-sizing:border-box;font-family:inherit}.kj-head{background:#183a2c;color:white;padding:15px;display:flex;align-items:center;justify-content:space-between}.kj-head strong{font-size:18px}.kj-head small{display:block;opacity:.7;margin-top:3px}.kj-head button{background:none;color:white;border:0;font-size:20px}.kj-body{padding:15px;display:grid;gap:11px;overflow:auto}.kj-body label{display:block;font-weight:600;margin:4px 0 5px}.kj-body input,.kj-body select,.kj-body textarea{width:100%;border:1px solid #bbcbbe;border-radius:8px;background:#fff;color:#183a2c;padding:10px;font-size:13px}.kj-body textarea{min-height:85px;resize:vertical}.kj-body p{margin:0;line-height:1.45}.kj-body button{border:1px solid #b9cebd;border-radius:8px;background:#fff;color:#183a2c;padding:10px;cursor:pointer}.kj-row{display:flex;gap:7px}.kj-row>*{flex:1;min-width:0}.kj-chat{height:150px;overflow:auto;border-radius:8px;background:#e6ede5;padding:10px}.kj-chat p{margin-bottom:8px}.kj-chat b{display:block;margin-bottom:3px}.kj-status{background:#e6efe5;border-radius:8px;padding:10px;overflow-wrap:anywhere}.kj-status a{color:#075a70}.kj-picked{outline:3px solid #42a37c!important;outline-offset:2px}";
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}
export function mountKijazo(config={}) {
  const opt={title:'Kijazo',enableWhen:'query-param',initialContent:{},project:'',...config};
  if(opt.enableWhen==='query-param'&&!new URLSearchParams(location.search).has('kijazo'))return {open(){},close(){},destroy(){}};
  if(!document.body)throw new Error('Mount Kijazo after the page body is available');
  const original={...opt.initialContent};let content={...original},key='',picked=null,choosing=false,disposed=false;
  const host=el('div');host.dataset.kijazo='';const shadow=host.attachShadow({mode:'open'}),style=el('style',CSS);
  shadow.append(style);document.body.append(host);
  const trigger=el('button','✦ Edit with Kijazo');trigger.className='kj-trigger';shadow.append(trigger);
  const panel=el('aside');panel.className='kj-panel';panel.hidden=true;panel.setAttribute('aria-label','Kijazo editor');shadow.append(panel);
  const head=el('div');head.className='kj-head';const title=el('div');title.append(el('strong',opt.title),el('small','Build directly in your website'));const closeButton=el('button','×');closeButton.type='button';head.append(title,closeButton);panel.append(head);
  const body=el('div');body.className='kj-body';panel.append(body);
  body.append(el('p','Choose a page element, edit text, or ask Kijazo to build any feature. AI changes become GitHub proposals for review.'));
  const pick=el('button','◎ Select element on page');body.append(pick);
  const fields=Object.keys(original);let selector=null,textarea=null;
  if(fields.length){const wrap=el('div');wrap.append(el('label','Content field'));selector=el('select');for(const field of fields){const option=el('option',field);option.value=field;selector.append(option)}wrap.append(selector);body.append(wrap);
    const edit=el('div');edit.append(el('label','Text'));textarea=el('textarea');textarea.value=String(content[selector.value]??'');edit.append(textarea);body.append(edit);
    selector.addEventListener('change',()=>{textarea.value=String(content[selector.value]??'')});
    textarea.addEventListener('input',()=>{content[selector.value]=textarea.value;opt.onContentChange?.({...content})});
  }
  const chat=el('div');chat.className='kj-chat';chat.setAttribute('role','log');body.append(chat);
  const say=(who,msg)=>{const p=el('p');p.append(el('b',who),document.createTextNode(String(msg)));chat.append(p);chat.scrollTop=chat.scrollHeight};
  say('Kijazo','I can edit site content here, or send a free-form coding request to the AI agent at your configured API.');
  const row=el('div');row.className='kj-row';const prompt=el('input');prompt.placeholder='Build a new feature in my world…';prompt.setAttribute('aria-label','Ask Kijazo');const send=el('button','Build');row.append(prompt,send);body.append(row);
  const keyWrap=el('div');keyWrap.append(el('label','Editor key (never saved)'));const pass=el('input');pass.type='password';pass.autocomplete='off';pass.placeholder='Editor key for AI requests';pass.addEventListener('input',()=>{key=pass.value});keyWrap.append(pass);body.append(keyWrap);
  const status=el('div','Local edits are visible only in your browser.');status.className='kj-status';body.append(status);
  const actions=el('div');actions.className='kj-row';const exportButton=el('button','Export content JSON');const reset=el('button','Reset');actions.append(exportButton,reset);body.append(actions);
  function stopPicking(){choosing=false;pick.textContent='◎ Select element on page'}
  function onPick(event){if(!choosing||!(event.target instanceof Element)||event.composedPath().includes(host))return;event.preventDefault();event.stopPropagation();
    const target=event.target;const classes=[...target.classList].slice(0,3).map(x=>'.'+x).join('');picked={selector:target.tagName.toLowerCase()+(target.id?'#'+target.id:classes),html:target.outerHTML.slice(0,2000),text:target.textContent?.slice(0,300)};
    say('Kijazo','Selected '+picked.selector);stopPicking();
  }
  document.addEventListener('click',onPick,true);pick.addEventListener('click',()=>{choosing=!choosing;pick.textContent=choosing?'Click any part of the website…':'◎ Select element on page'});
  const open=()=>{panel.hidden=false;trigger.hidden=true;prompt.focus()},close=()=>{panel.hidden=true;trigger.hidden=false;stopPicking()};
  trigger.addEventListener('click',open);closeButton.addEventListener('click',close);
  exportButton.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(content,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='kijazo-content.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),500)});
  reset.addEventListener('click',()=>{content={...original};if(textarea)textarea.value=String(content[selector.value]??'');opt.onContentChange?.({...content});status.textContent='Reset local edits.'});
  async function submit(){
    const instruction=prompt.value.trim();if(!instruction)return;prompt.value='';say('You',instruction);
    if(!opt.apiUrl){say('Kijazo','The AI API is not configured yet.');return}
    if(!key){say('Kijazo','Enter the editor key to submit this coding request.');return}
    send.disabled=true;status.textContent='Kijazo is working…';
    try{
      const res=await fetch(opt.apiUrl.replace(/\/$/,'')+'/api/changes',{method:'POST',headers:{'content-type':'application/json','x-kijazo-editor-key':key},body:JSON.stringify({instruction,project:opt.project,page:location.href,selected:picked})});
      if(!res.ok)throw new Error('API '+res.status+': '+(await res.text()).slice(0,250));
      if(!res.body)throw new Error('Streaming responses unavailable');
      const reader=res.body.getReader(),decoder=new TextDecoder();let pending='',complete=null;
      for(;;){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const messages=pending.split('\n\n');pending=messages.pop()||'';
        for(const msg of messages){const data=msg.split('\n').find(x=>x.startsWith('data: '));if(!data)continue;let event;try{event=JSON.parse(data.slice(6))}catch{continue}
          if(event.type==='status'){status.textContent=event.message;say('Kijazo',event.message)}
          if(event.type==='complete')complete=event;
          if(event.type==='error')throw new Error(event.message);
        }
      }
      if(complete?.prUrl){status.replaceChildren(document.createTextNode('Code changes ready: '));const a=el('a','Review on GitHub');a.href=complete.prUrl;a.target='_blank';a.rel='noopener noreferrer';status.append(a);say('Kijazo',complete.message||'Created your pull request.')}
      else status.textContent='The agent ended without a PR. Review the messages above.';
    }catch(error){status.textContent=String(error.message||error);say('Kijazo',String(error.message||error))}finally{send.disabled=false}
  }
  send.addEventListener('click',()=>void submit());prompt.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void submit()}});
  return {open,close,destroy(){if(disposed)return;disposed=true;document.removeEventListener('click',onPick,true);host.remove()}};
}
