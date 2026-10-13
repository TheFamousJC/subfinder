import { readFile, writeFile } from 'node:fs/promises';

let html = await readFile('public/index.html', 'utf8');
const css = await readFile('public/style.css', 'utf8');
let app = await readFile('public/app.js', 'utf8');
let detector = await readFile('lib/detect.mjs', 'utf8');
let demo = await readFile('lib/demo.mjs', 'utf8');
detector = detector.replace(/import .*?;\n/, '').replaceAll('export function', 'function').replace("createHash('sha256').update(key).digest('hex').slice(0,16)", 'key');
// Browser imports support plain-text receipts; encoded EML requires the server edition.
detector = detector.replace("Buffer.from(body,'base64').toString('utf8')", "new TextDecoder().decode(Uint8Array.from(atob(body.replace(/\\s/g,'')), c=>c.charCodeAt(0)))");
demo = demo.replace(/import .*?;\n/, '').replace('export function', 'function');
const offlineRequest = `async function request(path,data={}) {
  if(path==='/api/demo') return {records:demo()};
  if(path==='/api/logout') { records=[]; session.demo=false; return {ok:true}; }
  if(path==='/api/status') return {ok:true};
  if(path==='/api/import') {
    const messages=data.format==='eml'?[parseEml(data.content)]:JSON.parse(data.content);
    if(!Array.isArray(messages)||messages.length>500||messages.some(m=>!m||typeof m.body!=='string'||typeof m.from!=='string'||typeof m.subject!=='string'||typeof m.date!=='string')) throw new Error('Use an array of up to 500 receipts with from, subject, date and body strings.');
    return {records:detect(messages),scanned:messages.length};
  }
  throw new Error('Live email connections require the local server edition.');
}`;
app = app.replace(/async function request\(path,data\)\{[^\n]+\}/, offlineRequest);
app = app.replace(/async function refresh\(\)\{[^\n]+\}/, "async function refresh(){session={demo:session?.demo || false,records,configured:{google:false,microsoft:false}};render();}");
app = app.replace("Register this provider and add its credentials to .env. Setup steps are in README.md.", "For secure email login, run npm start and open http://localhost:3210. This standalone file supports demo and receipt imports.");
app = app.replace("Live login needs provider registration. See README.md; the demo and receipt import work now.", "Standalone HTML edition. Demo and receipt import work here. For secure live email login, run npm start and open http://localhost:3210.");
app = app.replace('Choose a provider to complete setup here, then sign in and scan.', 'For live email access, double-click Start SubFinder.cmd. Then choose a provider here to open the local app. Demo and receipt imports also work offline.');
html = html.replace('<link rel="stylesheet" href="/style.css"><script type="module" src="/app.js"></script>', `<style>${css}</style>`);
html = html.replace('href="/"', 'href="#"');
html = html.replace('This edition runs on your computer. Provider tokens and extracted receipts are held in server memory for up to one hour. No mailbox passwords or refresh tokens are stored.', 'This standalone HTML edition processes imported receipts in this browser tab. It does not connect to your mailbox. No mailbox passwords or provider tokens are requested.');
html = html.replace('Disconnect clears the session. Server restart clears all sessions. Exported CSV files remain wherever you save them.', 'Clear the session or close this tab to discard imported data. Exported CSV files remain wherever you save them.');
html = html.replace('Receipts stay in this server session, never sent to an AI service.', 'Receipts stay in this browser tab, never sent to an AI service.');
html = html.replace('</body>', () => `<script type="module">${detector}\n${demo}\n${app}</script></body>`);
await writeFile('SubFinder.html', html);
console.log('Created SubFinder.html');
