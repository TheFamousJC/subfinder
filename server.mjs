import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { detect, parseEml } from './lib/detect.mjs';
import { demo } from './lib/demo.mjs';
import { googleClientError } from './lib/oauth-config.mjs';

const port = Number(process.env.PORT || 3210);
const appUrl = new URL(process.env.APP_URL || `http://localhost:${port}`);
if (!['localhost','127.0.0.1'].includes(appUrl.hostname)) throw new Error('This local edition requires a loopback APP_URL.');
const sessions = new Map();
const random = () => randomBytes(32).toString('base64url');
const providers = {
  google:{id:process.env.GOOGLE_CLIENT_ID,secret:process.env.GOOGLE_CLIENT_SECRET,authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'openid email https://www.googleapis.com/auth/gmail.readonly'},
  microsoft:{id:process.env.MICROSOFT_CLIENT_ID,secret:process.env.MICROSOFT_CLIENT_SECRET,authorize:'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',token:'https://login.microsoftonline.com/common/oauth2/v2.0/token',scope:'openid email https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read'}
};
function json(res,status,data) { res.writeHead(status,{'Content-Type':'application/json'}); res.end(JSON.stringify(data)); }
async function api(url,token) {
  const response = await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(response.status===401 ? 'Email session expired. Disconnect and reconnect your account.' : 'The email provider could not complete this request.');
  return response.json();
}
function bodyText(payload) {
  if (payload.mimeType==='text/plain' && payload.body?.data) return Buffer.from(payload.body.data,'base64url').toString('utf8');
  const parts = payload.parts || [];
  const plain = parts.filter(p=>p.mimeType!=='text/html').map(bodyText).filter(Boolean).join('\n');
  return plain || (payload.body?.data ? Buffer.from(payload.body.data,'base64url').toString('utf8') : parts.map(bodyText).join('\n'));
}
async function scan(session,months) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth()-months);
  const messages = []; let next; let truncated = false;
  if (session.provider==='google') {
    const q = `after:${cutoff.toISOString().slice(0,10).replaceAll('-','/')} {subscription membership renewal receipt invoice billing}`;
    do {
      const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages'); url.searchParams.set('q',q); url.searchParams.set('maxResults','100'); if(next) url.searchParams.set('pageToken',next);
      const page = await api(url,session.token); next = page.nextPageToken;
      for (const item of page.messages || []) {
        if(messages.length>=500) { truncated=true; break; }
        const message = await api(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`,session.token);
        const headers = message.payload.headers || []; const h = name=>headers.find(x=>x.name.toLowerCase()===name)?.value || '';
        messages.push({from:h('from'),subject:h('subject'),date:new Date(Number(message.internalDate)).toISOString(),body:bodyText(message.payload),sourceUrl:`https://mail.google.com/mail/u/${encodeURIComponent(session.email)}/#all/${encodeURIComponent(item.id)}`});
      }
    } while(next && messages.length<500);
  } else {
    next = `https://graph.microsoft.com/v1.0/me/messages?$top=100&$select=id,subject,from,receivedDateTime,body,webLink&$filter=receivedDateTime ge ${cutoff.toISOString()}&$orderby=receivedDateTime desc`;
    do {
      if(new URL(next).origin!=='https://graph.microsoft.com') throw new Error('Invalid provider pagination URL.');
      const page = await api(next,session.token); next = page['@odata.nextLink'];
      for(const m of page.value || []) { if(messages.length>=500) {truncated=true;break;} messages.push({from:`${m.from?.emailAddress?.name || ''} <${m.from?.emailAddress?.address || ''}>`,subject:m.subject,date:m.receivedDateTime,body:m.body?.content || '',sourceUrl:m.webLink}); }
    } while(next && messages.length<500);
  }
  return {records:detect(messages),scanned:messages.length,truncated:truncated || Boolean(next)};
}
const server = http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    if(req.headers.host!==appUrl.host) return json(res,403,{error:'Invalid host.'});
    const url = new URL(req.url,appUrl);
    let sid = req.headers.cookie?.match(/(?:^|;\s*)sf_session=([^;]+)/)?.[1];
    let session = sessions.get(sid);
    if(!session || session.expires<Date.now()) { if(sid) sessions.delete(sid); sid=random(); session={csrf:random(),expires:Date.now()+3600000,records:[]}; sessions.set(sid,session); res.setHeader('Set-Cookie',`sf_session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600${appUrl.protocol==='https:'?'; Secure':''}`); }
    if(req.method==='POST') {
      if(req.headers.origin!==appUrl.origin || req.headers['x-csrf-token']!==session.csrf) return json(res,403,{error:'Invalid request. Reload and try again.'});
      let raw=''; for await(const chunk of req) {raw+=chunk; if(Buffer.byteLength(raw)>2_000_000) return json(res,413,{error:'Import is limited to 2 MB.'});}
      const data=JSON.parse(raw || '{}');
      if(url.pathname==='/api/setup') {
        if(!Object.hasOwn(providers,data.provider) || typeof data.clientId!=='string' || typeof data.clientSecret!=='string' || !data.clientId.trim() || !data.clientSecret.trim() || data.clientId.length>500 || data.clientSecret.length>2000) return json(res,400,{error:'Choose a provider and enter the application client ID and secret.'});
        session.oauth ||= {};
        if(data.provider==='google' && googleClientError(data.clientId)) return json(res,400,{error:googleClientError(data.clientId)});
        session.oauth[data.provider]={id:data.clientId.trim(),secret:data.clientSecret.trim()};
        return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/demo') {session.records=demo(); session.demo=true; return json(res,200,{records:session.records});}
      if(url.pathname==='/api/logout') {sessions.delete(sid); res.setHeader('Set-Cookie','sf_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return json(res,200,{ok:true});}
      if(url.pathname==='/api/import') {
        const messages = data.format==='eml' ? [parseEml(data.content)] : JSON.parse(data.content);
        if(!Array.isArray(messages) || messages.length>500 || messages.some(m=>!m || typeof m.body!=='string' || typeof m.from!=='string' || typeof m.subject!=='string' || typeof m.date!=='string')) return json(res,400,{error:'Use an array of up to 500 receipts with from, subject, date and body strings.'});
        session.records=detect(messages);session.demo=false;return json(res,200,{records:session.records,scanned:messages.length});
      }
      if(url.pathname==='/api/scan') {
        if(!session.token) return json(res,401,{error:'Connect an email account first.'});
        if(session.scanning) return json(res,409,{error:'A scan is already running.'});
        const months=Number(data.months);if(![3,6,12].includes(months)) return json(res,400,{error:'Choose 3, 6 or 12 months.'});
        session.scanning=true; try {const result=await scan(session,months);const decisions=new Map(session.records.map(r=>[r.id,r.status]));session.records=result.records.map(r=>({...r,status:decisions.get(r.id) || 'review'}));session.demo=false;return json(res,200,{...result,records:session.records});} finally {session.scanning=false;}
      }
      if(url.pathname==='/api/status') {const row=session.records.find(x=>x.id===data.id);if(!row || !['review','keep','cancel'].includes(data.status)) return json(res,400,{error:'Invalid subscription.'});row.status=data.status;return json(res,200,{ok:true});}
      return json(res,404,{error:'Not found.'});
    }
    if(req.method!=='GET') return json(res,405,{error:'Method not allowed.'});
    if(url.pathname==='/api/session') return json(res,200,{csrf:session.csrf,email:session.email,provider:session.provider,demo:session.demo,records:session.records,configured:Object.fromEntries(Object.entries(providers).map(([k,v])=>[k,Boolean((session.oauth?.[k] || v).id && (session.oauth?.[k] || v).secret)]))});
    if(url.pathname.startsWith('/auth/')) {
      const name=url.pathname.split('/')[2];if(!Object.hasOwn(providers,name)) return json(res,404,{error:'Unknown email provider.'});
      const provider={...providers[name],...session.oauth?.[name]}; if(!provider?.id || !provider.secret) return json(res,503,{error:'Open Connect email and complete connection setup.'});
      const redirect=`${appUrl.origin}/auth/${name}/callback`;
      if(name==='google' && googleClientError(provider.id)) throw new Error(googleClientError(provider.id));
      if(url.pathname.endsWith('/callback')) {
        const pending=session.pending;delete session.pending;
        const state=url.searchParams.get('state') || '';
        if(!pending || pending.provider!==name || pending.expires<Date.now() || state.length!==pending.state.length || !timingSafeEqual(Buffer.from(state),Buffer.from(pending.state))) return json(res,400,{error:'Login expired or state mismatch. Start again.'});
        if(url.searchParams.has('error')) throw new Error('Email permission was not granted. You can try again.');
        const response=await fetch(provider.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:provider.id,client_secret:provider.secret,code:url.searchParams.get('code') || '',grant_type:'authorization_code',redirect_uri:redirect,code_verifier:pending.verifier}),signal:AbortSignal.timeout(20000)});
        if(!response.ok) throw new Error('The provider could not complete login. Check your app registration.');
        const token=await response.json();
        const user=await api(name==='google'?'https://www.googleapis.com/oauth2/v2/userinfo':'https://graph.microsoft.com/v1.0/me',token.access_token);
        const newSid=random();const fresh={csrf:random(),expires:Date.now()+Math.min(Number(token.expires_in)||3600,3600)*1000,token:token.access_token,provider:name,email:user.email || user.mail || user.userPrincipalName,records:[],oauth:session.oauth};sessions.delete(sid);sessions.set(newSid,fresh);
        res.setHeader('Set-Cookie',`sf_session=${newSid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600${appUrl.protocol==='https:'?'; Secure':''}`);res.writeHead(302,{Location:'/?connected=1'});return res.end();
      }
      const verifier=random();const state=random();session.pending={provider:name,verifier,state,expires:Date.now()+600000};
      const auth=new URL(provider.authorize);for(const [key,value] of Object.entries({client_id:provider.id,redirect_uri:redirect,response_type:'code',scope:provider.scope,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}))auth.searchParams.set(key,value);
      res.writeHead(302,{Location:auth.href});return res.end();
    }
    const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};const file=files[url.pathname];if(!file)return json(res,404,{error:'Not found.'});
    const content=await readFile(new URL(`./public/${file}`,import.meta.url));res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript');res.end(content);
  } catch(error) {
    if(req.url.startsWith('/auth/')) {res.writeHead(302,{Location:`/?authError=${encodeURIComponent(error.message || 'Login failed. Try again.')}`});return res.end();}
    json(res,400,{error:error.message==='Unexpected end of JSON input'?'Invalid import file.':error.message || 'Request failed.'});
  }
});
setInterval(()=>{for(const [id,s] of sessions)if(s.expires<Date.now())sessions.delete(id);},60000).unref();
server.listen(port,'127.0.0.1',()=>console.log(`SubFinder ready at ${appUrl.origin}`));
