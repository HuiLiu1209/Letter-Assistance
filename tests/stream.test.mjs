import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';
import {readSSE,letterDeltas} from '../dist/stream.js';import {PrintLayout} from '../dist/print-layout.js';
import {createServer} from '../server.mjs';import {createChatHandler} from '../src/server/chat.mjs';import {presets} from '../dist/roles.js';
const encode=new TextEncoder();
const body=chunks=>new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(typeof chunk==='string'?encode.encode(chunk):chunk);c.close();}});
const event=value=>`data: ${JSON.stringify(value)}\n\n`;
async function collect(source){const items=[];for await(const item of source)items.push(item);return items;}
test('SSE survives byte boundaries inside UTF-8, CRLF and multiline data',async()=>{
  const raw=encode.encode(': heartbeat\r\ndata: {"text":\r\ndata: "谢谢你🌻"}\r\n\r\n');
  const result=await collect(readSSE(body([...raw].map(byte=>new Uint8Array([byte])))));
  assert.deepEqual(result.map(JSON.parse),[{text:'谢谢你🌻'}]);
});
test('the client accepts only explicitly completed streams; partial failures remain failures',async()=>{
  assert.deepEqual(await collect(letterDeltas(new Response(body([event({type:'delta',text:'Dear Alex,'}),event({type:'done'})])))),['Dear Alex,']);
  for(const tail of ['',event({type:'error',error:'Quota reached'})])await assert.rejects(()=>collect(letterDeltas(new Response(body([event({type:'delta',text:'Partial letter'}),tail])))));
  await assert.rejects(()=>collect(readSSE(body(['data: {"text":"cut short"}']))),/inside an event/);
});
test('incremental paper layout never reflows old ink and advances only at line breaks',()=>{
  const layout=new PrintLayout(text=>Array.from(text).length,{width:5,rowsPerPage:2});
  for(const char of 'abcde')layout.push(char);assert.deepEqual(layout.pages,[['abcde']]);
  const wrap=layout.push('f');assert.equal(wrap[0].type,'line');assert.equal(wrap[0].row,1);assert.deepEqual(layout.pages,[['abcde','f']]);
  layout.push('\r');layout.push('\n');assert.equal(layout.page,1);assert.equal(layout.row,0);layout.push('谢');assert.deepEqual(layout.pages,[['abcde','f'],['谢']]);
});
test('proxy forwards the first model chunk before the model finishes, then sends done',async()=>{
  let release,sourceFinished=false,requestedURL;
  const gate=new Promise(resolve=>release=resolve);
  const upstream=new ReadableStream({async start(c){c.enqueue(encode.encode(event({candidates:[{content:{parts:[{text:'Dear Alex, '}]}}]})));await gate;sourceFinished=true;c.enqueue(encode.encode(event({candidates:[{content:{parts:[{text:'thank you.'}]},finishReason:'STOP'}]})));c.close();}});
  const server=createServer({chat:createChatHandler({apiKey:'test-only',fetchImpl:async url=>{requestedURL=url;return new Response(upstream);}})});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:presets[1],request:'Thank Alex.',model:'gemini-3.5-flash-lite',stream:true})});
    assert.match(response.headers.get('content-type'),/text\/event-stream/);assert.match(requestedURL,/:streamGenerateContent\?alt=sse$/);
    const chunks=letterDeltas(response);let timer;
    const first=await Promise.race([chunks.next(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('First chunk was buffered')),1000);})]);clearTimeout(timer);
    assert.equal(first.value,'Dear Alex, ');assert.equal(sourceFinished,false);release();assert.equal((await chunks.next()).value,'thank you.');assert.equal((await chunks.next()).done,true);
  }finally{release();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('a blocked or truncated upstream emits an error after partial ink, never done',async()=>{
  const data=body([event({candidates:[{content:{parts:[{text:'Partial'}]}}]}),event({candidates:[{finishReason:'MAX_TOKENS'}]})]);
  const server=createServer({chat:createChatHandler({apiKey:'test-only',fetchImpl:async()=>new Response(data)})});server.listen(0,'127.0.0.1');await once(server,'listening');
  try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:presets[1],request:'Thank Alex.',model:'gemini-3.5-flash-lite',stream:true})});await assert.rejects(()=>collect(letterDeltas(response)),/could not be completed/);}
  finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
