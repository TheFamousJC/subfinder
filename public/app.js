const $ = id=>document.getElementById(id);
let session, records=[], filter='all';
const money=(amount,currency)=>new Intl.NumberFormat('en-US',{style:'currency',currency}).format(amount);
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,6000);}
async function request(path,data){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify(data || {})});const result=await response.json();if(!response.ok)throw new Error(result.error || 'Request failed.');return result;}
async function action(fn){try{await fn();}catch(error){toast(error.message);}}
function open(id){$(id).showModal();}
function monthly(row){return row.cycle==='yearly'?row.amount/12:row.cycle==='monthly'?row.amount:0;}
function render(){
  const currency=$('currency').value;const matching=records.filter(r=>r.currency===currency);
  $('monthly').textContent=matching.length?money(matching.reduce((n,r)=>n+monthly(r),0),currency):'—';
  $('savings').textContent=matching.length?money(matching.filter(r=>r.status==='cancel').reduce((n,r)=>n+monthly(r),0),currency):'—';
  $('currency-note').textContent=`${currency} only · Unknown billing cycles excluded`;
  $('total').replaceChildren(document.createTextNode(`${records.length} `));const small=document.createElement('small');small.textContent='services';$('total').append(small);
  $('review-count').textContent=records.filter(r=>r.status==='review').length;
  $('account').textContent=session.email || 'Connect an inbox ↗';
  $('mode-text').textContent=session.demo?'Demo workspace · Sample subscriptions, not your email':session.email?`Connected to ${session.email} · Read-only access`:records.length?'Imported receipts · Review matches before making a decision':'Start with a secure email connection, or explore the demo.';
  $('demo').hidden=Boolean(session.demo);$('disconnect').hidden=!session.email && !records.length;
  $('rows').replaceChildren();
  const visible=matching.filter(r=>(filter==='all'||r.status===filter)&&r.provider.toLowerCase().includes($('search').value.toLowerCase()));
  for(const row of visible){
    const tr=document.createElement('tr');const service=document.createElement('td');const logo=document.createElement('div');logo.className='logo';logo.textContent=row.provider.slice(0,1);const desc=document.createElement('div');const name=document.createElement('div');name.className='service-name';name.textContent=row.provider;const sub=document.createElement('div');sub.className='service-sub';sub.textContent=`${row.receipts} receipt${row.receipts===1?'':'s'} found`;desc.append(name,sub);service.append(logo,desc);tr.append(service);
    for(const [value,cls] of [[money(row.amount,row.currency),'price'],[row.cycle==='unknown'?'Not confirmed':row.cycle==='yearly'?'Annual':'Monthly',''],[`${row.confidence} · ${new Date(row.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,'']]){const td=document.createElement('td');const span=document.createElement('span');span.className=cls;span.textContent=value;td.append(span);tr.append(td);}
    const decision=document.createElement('td');const select=document.createElement('select');select.className='decision';select.setAttribute('aria-label',`Decision for ${row.provider}`);for(const [value,text] of [['review','Needs review'],['keep','Keep'],['cancel','To cancel']]){const option=new Option(text,value);select.append(option);}select.value=row.status;select.onchange=()=>action(async()=>{await request('/api/status',{id:row.id,status:select.value});row.status=select.value;render();});decision.append(select);tr.append(decision);
    const details=document.createElement('td');const button=document.createElement('button');button.className='detail';button.textContent='↗';button.setAttribute('aria-label',`View receipt for ${row.provider}`);button.onclick=()=>showDetail(row);details.append(button);tr.append(details);$('rows').append(tr);
  }
  $('empty').hidden=visible.length>0;$('empty').querySelector('h3').textContent=records.length?'No matching subscriptions.':'Let’s find what’s on repeat.';
  $('result-count').textContent=`${visible.length} of ${records.length} subscriptions · ${currency}`;
  document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter===filter));
}
function showDetail(row){$('detail-title').textContent=row.provider;$('detail-meta').textContent=`${money(row.amount,row.currency)} · ${row.cycle} · ${new Date(row.date).toLocaleDateString()} — ${row.subject}`;$('detail-body').textContent=row.evidence;let safe=false;try{const u=new URL(row.sourceUrl);safe=u.protocol==='https:'&&['mail.google.com','outlook.live.com','outlook.office.com','outlook.office365.com'].includes(u.hostname);}catch{}$('source-link').hidden=!safe;if(safe)$('source-link').href=row.sourceUrl;open('detail-dialog');}
async function refresh(){const response=await fetch('/api/session');session=await response.json();records=session.records;render();}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
for(const id of ['account','connect-nav','empty-connect'])$(id).onclick=()=>open('connect-dialog');
$('privacy').onclick=()=>open('privacy-dialog');
$('overview').onclick=()=>{filter='all';$('search').value='';render();};$('review-nav').onclick=()=>{filter='review';render();};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});$('search').oninput=render;$('currency').onchange=render;
$('demo').onclick=()=>action(async()=>{const result=await request('/api/demo');records=result.records;session.demo=true;filter='all';$('currency').value='USD';render();toast('Demo loaded. These are sample receipts.');});
let setupProvider='google';
function setup(name){
  if(location.protocol==='file:') {window.location.assign('http://localhost:3210/');return;}
  setupProvider=name;$('connect-dialog').close();$('setup-title').textContent=name==='google'?'Set up Gmail access.':'Set up Outlook access.';
  credentialLabel.hidden=name!=='google';
  $('redirect-uri').value=`${location.origin}/auth/${name}/callback`;
  const steps=name==='google'?['Create a Google Cloud project and enable the Gmail API.','Configure OAuth consent with Gmail read-only access. In testing, add your email as a test user.','Create a Web application OAuth client. Add the redirect URI below. Copy its client ID and secret.']:['Register an app in Microsoft Entra. Select personal and organizational accounts if you need both.','Add a Web redirect using the URI below. Add delegated User.Read and Mail.Read permissions.','Create a client secret. Copy its VALUE and the application (client) ID. Workplace accounts may need administrator consent.'];
  $('setup-steps').replaceChildren(...steps.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  $('registration-link').href=name==='google'?'https://console.cloud.google.com/apis/credentials':'https://entra.microsoft.com/';
  $('client-id').value='';$('client-secret').value='';$('setup-error').textContent='';open('setup-dialog');
}
for(const name of ['google','microsoft'])$(name).onclick=()=>{if(!session.configured[name])return setup(name);window.location.assign(`/auth/${name}`);};
const fixGoogle=document.createElement('button');fixGoogle.className='text-button';fixGoogle.textContent='Fix / configure Google connection';fixGoogle.onclick=()=>setup('google');$('google').after(fixGoogle);
const credentialLabel=document.createElement('label');credentialLabel.className='setup-field';credentialLabel.textContent='Or import Google’s downloaded Web client JSON';
const credentialFile=document.createElement('input');credentialFile.type='file';credentialFile.accept='.json';credentialLabel.append(credentialFile);$('setup-form').prepend(credentialLabel);
credentialFile.onchange=async()=>{try{const file=credentialFile.files[0];if(!file)return;if(file.size>20000)throw new Error('Choose the OAuth client JSON downloaded from Google Cloud.');const data=JSON.parse(await file.text());if(!data.web)throw new Error(data.installed?'This is a Desktop client. Create a Web application OAuth client for this app, with the redirect URI shown above.':'The file must contain a Google Web application OAuth client.');if(!/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(data.web.client_id || '')||typeof data.web.client_secret!=='string')throw new Error('The file does not contain valid client credentials.');if(!data.web.redirect_uris?.includes($('redirect-uri').value))throw new Error('Add the exact redirect URI shown above to this Google Web client, then download its JSON again.');$('client-id').value=data.web.client_id;$('client-secret').value=data.web.client_secret;$('setup-error').textContent='Credentials loaded locally. Choose Save and sign in.';}catch(error){$('setup-error').textContent=error.message;}finally{credentialFile.value='';}};
$('copy-redirect').onclick=()=>action(async()=>{await navigator.clipboard.writeText($('redirect-uri').value);toast('Redirect URI copied.');});
$('setup-form').onsubmit=async event=>{event.preventDefault();const button=$('setup-submit');button.disabled=true;$('setup-error').textContent='';try{await request('/api/setup',{provider:setupProvider,clientId:$('client-id').value,clientSecret:$('client-secret').value});$('client-secret').value='';window.location.assign(`/auth/${setupProvider}`);}catch(error){$('setup-error').textContent=error.message;}finally{button.disabled=false;}};
$('disconnect').onclick=()=>action(async()=>{await request('/api/logout');$('connect-dialog').close();await refresh();toast('Disconnected. This session’s tokens and receipts were cleared.');});
$('scan').onclick=()=>open(session.email?'scan-dialog':'connect-dialog');
$('scan-submit').onclick=()=>action(async()=>{const button=$('scan-submit');button.disabled=true;button.textContent='Scanning receipts…';try{const result=await request('/api/scan',{months:Number($('months').value)});records=result.records;session.demo=false;filter='all';render();$('scan-dialog').close();toast(`Scanned ${result.scanned} messages.${result.truncated?' Scan limit reached; some emails were not checked.':''}`);}finally{button.disabled=false;button.textContent='Start scan';}});
for(const id of ['import-open','connect-import'])$(id).onclick=()=>{$('connect-dialog').close();open('import-dialog');};
$('import-submit').onclick=()=>action(async()=>{const file=$('file').files[0];if(!file)throw new Error('Select an .eml or .json file first.');if(file.size>2_000_000)throw new Error('Choose a file smaller than 2 MB.');if(!/\.(eml|json)$/i.test(file.name))throw new Error('Choose .eml or .json.');const result=await request('/api/import',{format:file.name.toLowerCase().endsWith('.eml')?'eml':'json',content:await file.text()});records=result.records;session.demo=false;filter='all';if(records[0])$('currency').value=records[0].currency;render();$('import-dialog').close();toast(`Found ${records.length} possible subscriptions in ${result.scanned} receipts.`);});
$('export').onclick=()=>{if(!records.length)return toast('Load a demo, import receipts, or scan your inbox first.');const cell=x=>`"${String(x).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')}"`;const csv=[['Provider','Amount','Currency','Billing','Last receipt','Receipts','Decision','Confidence'],...records.map(r=>[r.provider,r.amount,r.currency,r.cycle,r.date,r.receipts,r.status,r.confidence])].map(r=>r.map(cell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='subfinder-subscriptions.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
await action(async()=>{await refresh();$('setup-note').textContent=Object.values(session.configured).some(Boolean)?'Choose your provider to authorize read-only access.':'Choose a provider to complete setup here, then sign in and scan.';const params=new URLSearchParams(location.search);if(params.has('authError')){history.replaceState(null,'','/');open('connect-dialog');$('setup-note').textContent=params.get('authError');}if(params.has('connected')&&session.email){history.replaceState(null,'','/');open('scan-dialog');toast('Email connected. Choose your scan history and start.');}});
