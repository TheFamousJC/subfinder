import test from 'node:test';
import assert from 'node:assert/strict';
import { googleClientError } from '../lib/oauth-config.mjs';
test('rejects mistaken Google identifiers before authorization',()=>{
  for(const id of ['jdcardash@gmail.com','my-project','123456789','GOCSPX-secret','YOUR_CLIENT_ID',undefined]) assert.ok(googleClientError(id));
  assert.equal(googleClientError('123456789-abcdef.apps.googleusercontent.com'),null);
});
