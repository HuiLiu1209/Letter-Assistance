// Explicit UI test fixture. Never used by npm start or the production API.
import {createServer} from '../server.mjs';
import {createChatHandler} from '../src/server/chat.mjs';
const text='Dear Alex,\n\nThank you for helping me prepare my project presentation. Your thoughtful feedback helped me explain my ideas more clearly, and your encouragement made a real difference.\n\nI especially appreciated the time you took to walk through the slides with me. I felt much more confident presenting the final work.\n\nWith thanks,\nSam';
createServer({chat:createChatHandler({apiKey:'fixture-only',fetchImpl:async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]})})}).listen(4174,'127.0.0.1',()=>console.log('FIXTURE preview only: http://127.0.0.1:4174'));
