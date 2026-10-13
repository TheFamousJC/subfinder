import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('session, demo, CSRF, import isolation and logout',async()=>{
  const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3219',APP_URL:'http://127.0.0.1:3219'},stdio:['ignore','pipe','pipe']});
  try {
    await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('Server exited before readiness.');}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Server startup timed out.')),10000).unref())]);
    const base='http://127.0.0.1:3219';
    const get=path=>fetch(base+path,{headers:{Host:'127.0.0.1:3219'}});
    const page=await get('/');assert.equal(page.status,200);assert.ok(page.headers.get('content-security-policy'));
    const response=await get('/api/session');const cookie=response.headers.get('set-cookie').split(';')[0];const state=await response.json();
    const headers={Host:'127.0.0.1:3219',Cookie:cookie,Origin:'http://127.0.0.1:3219','X-CSRF-Token':state.csrf,'Content-Type':'application/json'};
    const post=(path,data={},h=headers)=>fetch(base+path,{method:'POST',headers:h,body:JSON.stringify(data)});
    assert.equal((await post('/api/setup',{provider:'google',clientId:'',clientSecret:''})).status,400);
    assert.equal((await post('/api/setup',{provider:'google',clientId:'123456789-testclient.apps.googleusercontent.com',clientSecret:'test-secret'})).status,200);
    const configured=await fetch(base+'/api/session',{headers:{Host:'127.0.0.1:3219',Cookie:cookie}});const configuredText=await configured.text();assert.equal(JSON.parse(configuredText).configured.google,true);assert.ok(!configuredText.includes('test-secret'));assert.ok(!configuredText.includes('123456789-testclient.apps.googleusercontent.com'));
    const isolated=await get('/api/session');assert.equal((await isolated.json()).configured.google,false);
    const authorization=await fetch(base+'/auth/google',{headers:{Cookie:cookie},redirect:'manual'});assert.equal(authorization.status,302);const authUrl=new URL(authorization.headers.get('location'));assert.equal(authUrl.hostname,'accounts.google.com');assert.equal(authUrl.searchParams.get('code_challenge_method'),'S256');assert.equal(authUrl.searchParams.get('client_id'),'123456789-testclient.apps.googleusercontent.com');assert.ok(authUrl.searchParams.get('state'));assert.ok(!authorization.headers.get('location').includes('test-secret'));
    const demo=await post('/api/demo');assert.equal(demo.status,200);assert.equal((await demo.json()).records.length,8);
    assert.equal((await post('/api/demo',{}, {Host:'127.0.0.1:3219',Cookie:cookie,'Content-Type':'application/json'})).status,403);
    const other=await get('/api/session');assert.equal((await other.json()).records.length,0);
    const imported=await post('/api/import',{format:'json',content:JSON.stringify([{from:'Test <bill@test.example>',subject:'Monthly subscription receipt',date:'2026-10-01',body:'Total charged EUR 8'}])});assert.equal((await imported.json()).records[0].currency,'EUR');
    assert.equal((await post('/api/logout')).status,200);
    const loggedOut=await fetch(base+'/api/session',{headers:{Host:'127.0.0.1:3219',Cookie:cookie}});assert.equal((await loggedOut.json()).records.length,0);
  } finally {child.kill();}
});


