import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {validateClient,settings,remember,disconnect,connectMicrosoft,finishMicrosoft,connected,scanMailbox} from './browser-connections.js';
test('BYO client IDs, PKCE callback state, token isolation and provider pagination',async()=>{
 const storage=new Map();let assigned,requests=[];
 globalThis.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 globalThis.crypto ||= webcrypto;
 globalThis.location={origin:'https://demo.example',pathname:'/subfinder/',href:'https://demo.example/subfinder/',assign:url=>{assigned=url;}};
 globalThis.history={replaceState:(_,__,url)=>{location.href=location.origin+url;}};
 assert.throws(()=>validateClient('google','a-client-secret'));
 assert.throws(()=>validateClient('microsoft','password'));
 const id='12345678-1234-1234-1234-123456789abc';
 remember('microsoft',id);assert.equal(settings().microsoft,id);
 await connectMicrosoft(id);const auth=new URL(assigned);assert.equal(auth.hostname,'login.microsoftonline.com');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');assert.equal(auth.searchParams.get('redirect_uri'),'https://demo.example/subfinder/');assert.ok(!auth.searchParams.has('client_secret'));assert.ok(!auth.searchParams.get('scope').includes('offline_access'));
 globalThis.fetch=async()=>{throw Error('Unexpected network request');};
 location.href=location.origin+location.pathname+'?code=code&state=invalid';await assert.rejects(finishMicrosoft(),/could not be verified/);assert.ok(!location.href.includes('code='));
 await connectMicrosoft(id);const valid=new URL(assigned);const state=valid.searchParams.get('state');location.href=location.origin+location.pathname+'?code=test-code&state='+state;
 globalThis.fetch=async(url,options)=>{
  requests.push({url:String(url),options});
  if(String(url).endsWith('/token')){assert.ok(!options.body.has('client_secret'));assert.ok(options.body.get('code_verifier'));return {ok:true,json:async()=>({access_token:'memory-only-token',expires_in:3600,scope:'User.Read Mail.Read'})};}
  if(String(url).endsWith('/me'))return {ok:true,json:async()=>({mail:'test@example.test'})};
  if(String(url).includes('/messages'))return {ok:true,json:async()=>({'@odata.nextLink':'https://attacker.example/messages',value:[]})};
  throw Error('Unexpected URL');
 };
 const account=await finishMicrosoft();assert.equal(account.email,'test@example.test');assert.ok(!JSON.stringify(account).includes('memory-only-token'));assert.ok(![...storage.values()].join('').includes('memory-only-token'));
 await assert.rejects(scanMailbox(12),/Unexpected provider address/);assert.ok(!requests.some(r=>r.url.includes('attacker.example')));
 disconnect();assert.equal(connected(),null);assert.equal(storage.size,0);await assert.rejects(scanMailbox(12),/expired/);
});

