import { createChatHandler } from '../src/server/chat.mjs';
export default createChatHandler({apiKey: process.env.GEMINI_API_KEY});
