// Direct browser OAuth: visitors supply public client IDs, never client secrets.
const GMAIL='https://www.googleapis.com/auth/gmail.readonly';
const MS_SCOPES='https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read';
const PENDING='subfinder.microsoft.pending.v1';
const SETTINGS='subfinder.public-client-ids.v1';
let connection=null, controller=null, scanning=false;
export const callbackUrl=()=>location.origin+location.pathname;
export function validateClient(provider,id){
 id=String(id||'').trim();
 if(provider==='google'&&!/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(id))throw Error('Enter the complete Google OAuth client ID ending in .apps.googleusercontent.com.');
 if(provider==='microsoft'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error('Enter your Microsoft Application (client) ID, a GUID.');
 return id;
}
export function settings(){try{return JSON.parse(sessionStorage.getItem(SETTINGS)||'{}');}catch{return {};}}
export function remember(provider,id){const values=settings();values[provider]=validateClient(provider,id);sessionStorage.setItem(SETTINGS,JSON.stringify(values));}
export function disconnect(){controller?.abort();controller=null;connection=null;sessionStorage.removeItem(PENDING);sessionStorage.removeItem(SETTINGS);}
function current(){if(!connection||connection.expires<=Date.now()){connection=null;throw Error('Email access expired. Connect again to continue.');}return connection;}
export function connected(){return connection&&connection.expires>Date.now()?{provider:connection.provider,email:connection.email}:null;}
function originAllowed(url,provider){const u=new URL(url);return u.protocol==='https:'&&(provider==='google'?['gmail.googleapis.com','www.googleapis.com'].includes(u.hostname):u.hostname==='graph.microsoft.com');}
async function providerGet(url,provider,token,signal){
 if(!originAllowed(url,provider))throw Error('Unexpected provider address.');
 const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal,redirect:'error',cache:'no-store',credentials:'omit'});
 if(!response.ok){if(response.status===401){connection=null;throw Error('Email access expired or was revoked. Connect again.');}throw Error(response.status===403?'Mail access was refused. Check your read-only permissions and app registration.':response.status===429?'Provider request limit reached. Please wait before retrying.':'The email provider could not complete this request.');}
 return response.json();
}
function setConnection(provider,token,email,seconds){connection={provider,token,email,expires:Date.now()+Math.min(Number(seconds)||3600,3600)*1000};return connected();}
let gisPromise;
export function prepareGoogle(){
 if(window.google?.accounts?.oauth2)return Promise.resolve();
 if(!gisPromise)gisPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=()=>resolve();script.onerror=()=>{gisPromise=null;reject(Error('Google sign-in could not load. Check your connection or browser blocking.'));};document.head.append(script);});
 return gisPromise;
}
export function connectGoogle(id){
 id=validateClient('google',id);
 if(!window.google?.accounts?.oauth2)throw Error('Google sign-in is still loading. Please try again in a moment.');
 return new Promise((resolve,reject)=>{
 const client=window.google.accounts.oauth2.initTokenClient({client_id:id,scope:`openid email ${GMAIL}`,include_granted_scopes:false,
 error_callback:error=>reject(Error(error.type==='popup_closed'?'Google sign-in was closed.':error.type==='popup_failed_to_open'?'Allow the Google sign-in popup and try again.':'Google sign-in could not start.')),
 callback:async response=>{try{if(response.error)throw Error('Google did not grant access. Check your app configuration and test users.');if(!window.google.accounts.oauth2.hasGrantedAllScopes(response,GMAIL))throw Error('Gmail read-only permission is required to scan receipts.');const user=await providerGet('https://www.googleapis.com/oauth2/v2/userinfo','google',response.access_token);remember('google',id);resolve(setConnection('google',response.access_token,user.email||'Gmail account',response.expires_in));}catch(e){reject(e);}}});
 client.requestAccessToken({prompt:'consent'});
 });
}
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const base64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export async function connectMicrosoft(id){
 id=validateClient('microsoft',id);remember('microsoft',id);
 const verifier=random(),state=random(),redirect=callbackUrl();
 const challenge=base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
 sessionStorage.setItem(PENDING,JSON.stringify({id,verifier,state,redirect,expires:Date.now()+600000}));
 const url=new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
 for(const [k,v] of Object.entries({client_id:id,response_type:'code',redirect_uri:redirect,response_mode:'query',scope:MS_SCOPES,state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}))url.searchParams.set(k,v);
 location.assign(url.href);
}
export async function finishMicrosoft(){
 const url=new URL(location.href);if(!url.searchParams.has('code')&&!url.searchParams.has('error'))return null;
 const code=url.searchParams.get('code'),state=url.searchParams.get('state'),denied=url.searchParams.has('error');
 for(const key of ['code','state','error','error_description','error_uri','session_state'])url.searchParams.delete(key);
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 let pending;try{pending=JSON.parse(sessionStorage.getItem(PENDING)||'null');}finally{sessionStorage.removeItem(PENDING);}
 if(!pending||pending.state!==state||pending.expires<Date.now()||pending.redirect!==callbackUrl())throw Error('Microsoft sign-in expired or could not be verified. Please start again.');
 if(denied)throw Error('Microsoft permission was not granted. You can try again.');
 const response=await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token',{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:pending.id,grant_type:'authorization_code',code,redirect_uri:pending.redirect,code_verifier:pending.verifier,scope:MS_SCOPES})});
 if(!response.ok)throw Error('Microsoft sign-in could not finish. Register the redirect as a Single-page application (SPA), then reconnect.');
 const result=await response.json();if(!result.access_token||!String(result.scope||'').split(/\s+/).some(s=>s.toLowerCase()==='mail.read'||s.toLowerCase()==='https://graph.microsoft.com/mail.read'))throw Error('Microsoft Mail.Read permission was not granted.');
 const user=await providerGet('https://graph.microsoft.com/v1.0/me','microsoft',result.access_token);
 return setConnection('microsoft',result.access_token,user.mail||user.userPrincipalName||'Outlook account',result.expires_in);
}
function gmailBody(payload){if(payload.mimeType==='text/plain'&&payload.body?.data)return new TextDecoder().decode(Uint8Array.from(atob(payload.body.data.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)));const plain=(payload.parts||[]).filter(p=>p.mimeType!=='text/html').map(gmailBody).filter(Boolean).join('\n');if(plain)return plain;if(payload.body?.data)return new TextDecoder().decode(Uint8Array.from(atob(payload.body.data.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)));return (payload.parts||[]).map(gmailBody).join('\n');}
export async function scanMailbox(months){
 if(![3,6,12].includes(months))throw Error('Choose 3, 6 or 12 months.');if(scanning)throw Error('A scan is already running.');
 const account=current();controller=new AbortController();const signal=controller.signal;scanning=true;
 try{
 const cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-months);const messages=[];let next;
 const get=url=>{current();return providerGet(url,account.provider,account.token,signal);};
 if(account.provider==='google'){
 do{const url=new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');url.searchParams.set('q',`after:${cutoff.toISOString().slice(0,10).replaceAll('-','/')} {subscription membership renewal receipt invoice billing}`);url.searchParams.set('maxResults','100');if(next)url.searchParams.set('pageToken',next);const page=await get(url);next=page.nextPageToken;for(const item of page.messages||[]){if(messages.length>=500)break;const m=await get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`);const h=name=>(m.payload?.headers||[]).find(v=>v.name.toLowerCase()===name)?.value||'';messages.push({from:h('from'),subject:h('subject'),date:new Date(Number(m.internalDate)).toISOString(),body:gmailBody(m.payload||{}),sourceUrl:`https://mail.google.com/mail/u/${encodeURIComponent(account.email)}/#all/${encodeURIComponent(item.id)}`});}}while(next&&messages.length<500);
 }else{
 next=`https://graph.microsoft.com/v1.0/me/messages?$top=100&$select=id,subject,from,receivedDateTime,body,webLink&$filter=receivedDateTime ge ${cutoff.toISOString()}&$orderby=receivedDateTime desc`;
 do{const page=await get(next);next=page['@odata.nextLink'];for(const m of page.value||[]){if(messages.length>=500)break;messages.push({from:`${m.from?.emailAddress?.name||''} <${m.from?.emailAddress?.address||''}>`,subject:m.subject||'',date:m.receivedDateTime,body:m.body?.content||'',sourceUrl:m.webLink});}}while(next&&messages.length<500);
 }
 if(signal.aborted||connection!==account)throw Error('Scan was cancelled.');return {messages,scanned:messages.length,truncated:Boolean(next)||messages.length>=500};
 }finally{scanning=false;controller=null;}
}
