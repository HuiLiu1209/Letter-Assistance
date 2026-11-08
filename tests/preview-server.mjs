// Explicit UI transport fixture; never used by npm start or the deployed API.
import {createServer} from '../server.mjs';import {createChatHandler} from '../src/server/chat.mjs';import {sampleLetter} from '../dist/sample-letters.js';
const chars=Array.from(sampleLetter('thank-you').text),encoder=new TextEncoder();
createServer({chat:createChatHandler({apiKey:'fixture-only',fetchImpl:async(url)=>{
  if(!url.includes('streamGenerateContent'))return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:chars.join('')}]}}]});
  let offset=0;return new Response(new ReadableStream({async pull(c){await new Promise(resolve=>setTimeout(resolve,80));const text=chars.slice(offset,offset+5).join('');offset+=5;const candidate={content:{parts:[{text}]}};if(offset>=chars.length)candidate.finishReason='STOP';c.enqueue(encoder.encode(`data: ${JSON.stringify({candidates:[candidate]})}\n\n`));if(offset>=chars.length)c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
}})}).listen(4174,'127.0.0.1',()=>console.log('FIXTURE only: http://127.0.0.1:4174 (Gemini stream is stubbed)'));
