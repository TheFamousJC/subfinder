import {readFile,writeFile} from 'node:fs/promises';
let html=await readFile('public/index.html','utf8');
const css=await readFile('public/style.css','utf8');
let app=await readFile('public/app.js','utf8');
let detector=await readFile('lib/detect.mjs','utf8');
let samples=await readFile('lib/demo.mjs','utf8');
detector=detector.replace(/import .*?;\n/,'').replaceAll('export function','function').replace("createHash('sha256').update(key).digest('hex').slice(0,16)",'key').replace("Buffer.from(body,'base64').toString('utf8')","new TextDecoder().decode(Uint8Array.from(atob(body.replace(/\\s/g,'')),c=>c.charCodeAt(0)))");
samples=samples.replace(/import .*?;\n/,'').replace('export function','function');
const request=`async function request(path,data={}) {
 if(path==='/api/demo') return {records:demo()};
 if(path==='/api/logout'){records=[];session.demo=false;return {ok:true};}
 if(path==='/api/status')return {ok:true};
 if(path==='/api/import'){
  const messages=data.format==='eml'?[parseEml(data.content)]:JSON.parse(data.content);
  if(!Array.isArray(messages)||messages.length>500||messages.some(m=>!m||typeof m.body!=='string'||typeof m.from!=='string'||typeof m.subject!=='string'||typeof m.date!=='string'))throw new Error('Use an array of up to 500 receipts with from, subject, date and body strings.');
  return {records:detect(messages),scanned:messages.length};
 }
 throw new Error('Email connections are available in the local server edition.');
}`;
app=app.replace(/async function request\(path,data\)\{[^\n]+\}/,request);
app=app.replace(/async function refresh\(\)\{[^\n]+\}/,"async function refresh(){session={demo:session?.demo||false,records,configured:{google:false,microsoft:false}};render();}");
// Do not include OAuth credential forms or redirect visitors to localhost.
const start=app.indexOf("let setupProvider='google';");
const end=app.indexOf("$('disconnect').onclick");
if(start<0||end<start)throw new Error('Provider code boundaries changed; review the build.');
app=app.slice(0,start)+app.slice(end);
app=app.replace(/^\$\('scan-submit'\)\.onclick=.*\n/m,'');
app=app.replace("$('scan').onclick=()=>open(session.email?'scan-dialog':'connect-dialog');","$('scan').onclick=()=>open('import-dialog');");
app=app.replace("$('demo').hidden=Boolean(session.demo);","$('demo').hidden=false;");
app=app.replace("session.email || 'Connect an inbox ↗'","'Browser edition ↗'");
app=app.replace("'Start with a secure email connection, or explore the demo.'","'Browser edition · Import receipts or explore sample subscriptions.'");
app=app.replace("Disconnected. This session’s tokens and receipts were cleared.","Workspace cleared. Imported receipts and review decisions were discarded.");
app=app.replace("$('scan-dialog').close();",'');
const init=app.indexOf('await action(async()=>{await refresh();');
if(init<0)throw new Error('Initialization boundary changed.');
app=app.slice(0,init)+`await action(async()=>{await refresh();const result=await request('/api/demo');records=result.records;session.demo=true;render();});`;
html=html.replace('<link rel="stylesheet" href="/style.css"><script type="module" src="/app.js"></script>',()=>`<meta name="description" content="Try SubFinder in your browser: explore sample subscriptions, import receipts locally, review recurring costs, and export CSV."><style>${css}\n.browser-hint{font-size:12px;padding:12px 0;line-height:1.6;color:#62716b}.notice{flex-wrap:wrap}.notice button{white-space:nowrap}</style>`);
html=html.replace('href="/"','href="./"').replace('Connected email','Browser edition').replace('Read-only access. No sending, deleting, or changing emails.','Demo and receipt imports run in this tab. No mailbox connection or sign-in.').replace('Find the recurring charges hiding in your inbox.','Explore sample subscriptions or analyze receipt files on your device.').replace('↻ &nbsp; Scan inbox','↑ &nbsp; Import receipts').replace('Explore demo →','Reset sample demo →').replace('Connect Gmail or Outlook to scan receipts.<br>You can also import receipt files from another email provider.','Import plain-text .eml or JSON receipts, or reload the sample demo.').replace('Connect email →','How this demo works →');
html=html.replace(/<dialog id="connect-dialog">[\s\S]*?<\/dialog>/,`<dialog id="connect-dialog"><button class="close" data-close aria-label="Close">×</button><div class="eyebrow">LIVE BROWSER EDITION</div><h2>Try it without an account.</h2><p>Explore clearly labelled sample receipts, or import your own plain-text .eml or JSON receipt files. Detection, review decisions, and CSV export run in this browser tab.</p><p>Gmail and Outlook scans require SubFinder’s local server edition and your own provider registration. This hosted demo does not connect to email or request credentials.</p><button class="secondary wide" id="connect-import">Import receipt files</button><p><a href="https://github.com/TheFamousJC/subfinder#run" target="_blank" rel="noopener noreferrer">Get the local email-connected edition ↗</a></p><button class="text-button" id="disconnect">Clear this workspace</button></dialog>`);
html=html.replace(/<dialog id="setup-dialog">[\s\S]*?<\/dialog>/,'').replace(/<dialog id="scan-dialog">[\s\S]*?<\/dialog>/,'');
html=html.replace(/<dialog id="privacy-dialog">[\s\S]*?<\/dialog>/,`<dialog id="privacy-dialog"><button class="close" data-close aria-label="Close">×</button><h2>Your receipts stay in this tab.</h2><p>SubFinder processes imported receipts in browser memory. It does not upload receipt contents, connect to your mailbox, or request passwords or API credentials. Close or reload this tab to discard imported data and decisions.</p><p>Exported CSV files remain wherever you save them. GitHub Pages serves the site and receives normal page requests.</p><p>Detected subscriptions are candidates. Review the receipt; old receipts do not prove a subscription remains active. Marking “To cancel” does not cancel a service. Currency totals are separate and no conversion is performed.</p></dialog>`);
html=html.replace('Upload one plain-text .eml receipt','Choose one plain-text .eml receipt').replace('Receipts stay in this server session, never sent to an AI service.','Receipt contents stay in this browser tab. No AI service receives them.');
html=html.replace('</body>',()=>`<script type="module">${detector}\n${samples}\n${app}</script></body>`);
if(/fetch\(|client-secret|client-id|localhost:3210|\/auth\//.test(html))throw new Error('Server-only code remains in the browser edition.');
await writeFile('index.html',html);
console.log('Built browser-only SubFinder index.html');
