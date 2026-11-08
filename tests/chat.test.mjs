import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from '../server.mjs';
import {createChatHandler} from '../src/server/chat.mjs';
import {presets} from '../dist/roles.js';
const valid = {request:'Thank Alex for helping with my project. Sign Sam.',role:presets.find(role=>role.id==='thank-you'),model:'gemini-3.5-flash-lite'};
async function withServer(options, run) {
  const server=createServer({chat:createChatHandler(options)});server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/api/chat`;
  try {await run((body=valid,extra={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...extra.headers},body:typeof body==='string'?body:JSON.stringify(body),...extra}),url);}
  finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('missing credentials return an honest error without calling Google',async()=>{
  let called=false;await withServer({fetchImpl:async()=>{called=true;}},async send=>{const r=await send();assert.equal(r.status,503);assert.equal((await r.json()).code,'NOT_CONFIGURED');});assert.equal(called,false);
});
test('request and all eight role fields reach Gemini as user / system content',async()=>{
  let sent;await withServer({apiKey:'test-not-a-real-key',fetchImpl:async(url,options)=>{sent={url,options};return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'private reasoning',thought:true},{text:'Dear Alex,\nThank you.\nSam'}]}}]});}},async send=>{
    const r=await send();assert.equal(r.status,200);assert.deepEqual(await r.json(),{text:'Dear Alex,\nThank you.\nSam'});
  });
  assert.match(sent.url,/\/gemini-3\.5-flash-lite:generateContent$/);assert.equal(sent.options.headers['x-goog-api-key'],'test-not-a-real-key');
  const body=JSON.parse(sent.options.body);assert.equal(body.contents[0].parts[0].text,valid.request);assert.match(body.systemInstruction.parts[0].text,/Required Inputs:/);assert.match(body.systemInstruction.parts[0].text,/Do not send letters/);assert.match(body.systemInstruction.parts[0].text,/No Markdown/);assert.match(body.systemInstruction.parts[0].text,/Omit every detail the user has not supplied/);assert.match(body.systemInstruction.parts[0].text,/60–100 English words/);assert.ok(!body.systemInstruction.parts[0].text.includes('use [placeholders]'));assert.match(body.systemInstruction.parts[0].text,/Always write the letter in English, regardless of the input language/);
});
test('malformed, oversized, unsupported model and incomplete cards are rejected',async()=>{
  await withServer({},async send=>{
    for(const value of ['{', {...valid,request:''},{...valid,model:'../../invalid'},{...valid,role:{name:'Only a name'}}])assert.equal((await send(value)).status,400);
    assert.equal((await send('x'.repeat(100000))).status,413);
  });
});
test('method, content type and cross-site requests are rejected',async()=>{
  await withServer({},async(send,url)=>{
    assert.equal((await fetch(url)).status,405);assert.equal((await send(valid,{headers:{'Content-Type':'text/plain'}})).status,415);assert.equal((await send(valid,{headers:{Origin:'https://elsewhere.example'}})).status,403);
  });
});
test('quota, timeout, blocked and truncated replies never become saved letters',async()=>{
  for(const [fetchImpl,status] of [
    [async()=>new Response('secret upstream diagnostics',{status:429}),429],
    [async()=>{throw new DOMException('secret','TimeoutError');},504],
    [async()=>Response.json({promptFeedback:{blockReason:'SAFETY'}}),502],
    [async()=>Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'Incomplete'}]}}]}),502],
  ]) await withServer({apiKey:'secret',fetchImpl},async send=>{const r=await send();assert.equal(r.status,status);assert.ok(!(await r.text()).includes('secret'));});
});
