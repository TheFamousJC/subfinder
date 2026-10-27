import {readFile,writeFile} from 'node:fs/promises';
// First generate the standalone import/demo edition from the shared sources.
await import('./build-pages.mjs');
let html=await readFile('index.html','utf8');
let bundle=html.match(/<script type="module">([\s\S]*)<\/script>/)?.[1];
if(!bundle)throw Error('Missing app module.');
bundle=`import {mountSetupWizard} from './setup-wizard.js?v=sanitized-google1';\nimport {prepareGoogle,connectGoogle,connectMicrosoft,finishMicrosoft,scanMailbox,connected,disconnect,settings,callbackUrl} from './browser-connections.js?v=20261027-own-apps';\n`+bundle;
bundle=bundle.replace("if(path==='/api/logout'){records=[];session.demo=false;return {ok:true};}","if(path==='/api/logout'){disconnect();records=[];session.demo=false;return {ok:true};}\n if(path==='/api/scan'){const result=await scanMailbox(Number(data.months));return {...result,records:detect(result.messages)};}");
bundle=bundle.replace('async function refresh(){session={demo:session?.demo||false,records,configured:{google:false,microsoft:false}};render();}',"async function refresh(){session={demo:session?.demo||false,records,...connected(),configured:{google:true,microsoft:true}};render();}");
bundle=bundle.replace("'Browser edition ↗'","session.email||'Connect email ↗'");
bundle=bundle.replace("$('scan').onclick=()=>open('import-dialog');","$('scan').onclick=()=>open(connected()?'scan-dialog':'connect-dialog');");
const oldInit="await action(async()=>{await refresh();const result=await request('/api/demo');records=result.records;session.demo=true;render();});";
if(!bundle.includes(oldInit))throw Error('Initialization changed.');
bundle=bundle.replace(oldInit,`
async function connectAction(fn){$('connection-error').textContent='';try{await fn();}catch(error){$('connection-error').textContent=error.message;}}
const setupWizard=mountSetupWizard({settings,callbackUrl,prepareGoogle});
function showConnect(){setupWizard.open();}
for(const id of ['account','connect-nav','empty-connect'])$(id).onclick=showConnect;
$('scan').onclick=()=>connected()?open('scan-dialog'):showConnect();
$('google').onclick=()=>connectAction(async()=>{const result=await connectGoogle($('google-client').value);session={...session,...result,demo:false};records=[];render();$('connect-dialog').close();open('scan-dialog');});
$('microsoft').onclick=()=>connectAction(async()=>{await connectMicrosoft($('microsoft-client').value);});
$('scan-submit').onclick=()=>action(async()=>{const button=$('scan-submit');button.disabled=true;button.textContent='Scanning receipts…';try{const result=await request('/api/scan',{months:Number($('months').value)});records=result.records;session.demo=false;filter='all';if(records[0])$('currency').value=records[0].currency;render();$('scan-dialog').close();toast('Scanned '+result.scanned+' messages.'+(result.truncated?' Scan limit reached; some messages may not have been checked.':''));}finally{button.disabled=false;button.textContent='Start scan';}});
await action(async()=>{await refresh();const result=await finishMicrosoft();if(result){session={...session,...result,demo:false};records=[];render();open('scan-dialog');}else{const sample=await request('/api/demo');records=sample.records;session.demo=true;render();}});
`);
const wizardMarkup=await readFile('setup-wizard.html','utf8');
html=html.replace(/<dialog id="connect-dialog">[\s\S]*?<\/dialog>/,()=>wizardMarkup);
const wizardCss=await readFile('setup-wizard.css','utf8');
html=html.replace('</style>',()=>wizardCss+'</style>');
const original=await readFile('public/index.html','utf8');
const scanDialog=original.match(/<dialog id="scan-dialog">[\s\S]*?<\/dialog>/)?.[0];
html=html.replace('<div id="toast"',scanDialog+'<div id="toast"');
html=html.replace(/<dialog id="privacy-dialog">[\s\S]*?<\/dialog>/,`<dialog id="privacy-dialog"><button class="close" data-close aria-label="Close">×</button><h2>Direct from your browser.</h2><p>Demo and imported receipts are processed in this tab. When you connect your own app, the browser requests read-only access and talks directly to Google or Microsoft APIs. SubFinder does not run a mailbox backend, upload receipts to an AI service, or request client secrets.</p><p>Google’s sign-in library is loaded when you choose Gmail setup. Your provider handles sign-in and consent. Client IDs and a short-lived Microsoft PKCE verifier are held in tab session storage; access tokens and receipt data are held in memory. Disconnect clears SubFinder’s local connection and workspace. Reload discards the token and receipts. Remove access in your Google or Microsoft account settings to revoke the grant itself.</p><p>GitHub Pages receives normal hosting traffic. All projects under thefamousjc.github.io share a browser origin. This is a bring-your-own-registration demo, not a verified shared public OAuth application.</p><p>Detected subscriptions need review. Marking “To cancel” does not cancel a service. Different currencies are not converted.</p></dialog>`);
html=html.replace('↑ &nbsp; Import receipts','↻ &nbsp; Scan inbox').replace('Browser edition','Connect email').replace('Demo and receipt imports run in this tab. No mailbox connection or sign-in.','Use sample data, import receipts, or connect your own app with read-only access.');
html=html.replace('How this demo works →','Connect your own app →');
html=html.replace(/<script type="module">[\s\S]*<\/script>/,()=>`<script type="module">${bundle}</script>`);
await writeFile('index.html',html);
console.log('Built bring-your-own-client-ID browser edition');

