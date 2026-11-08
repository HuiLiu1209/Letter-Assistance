import { roleFields, models } from '../../dist/roles.js';
import {readSSE} from '../../dist/stream.js';
import {once} from 'node:events';
const MAX_BODY = 96 * 1024;
function json(res, status, data) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > MAX_BODY) throw Object.assign(new Error('Request is too large.'), {status: 413});
    try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid JSON request.'), {status: 400}); }
  }
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > MAX_BODY) throw Object.assign(new Error('Request is too large.'), {status: 413});
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON request.'), {status: 400}); }
}
function validate(body) {
  if (!body || typeof body.request !== 'string' || !body.request.trim() || body.request.length > 6000)
    throw Object.assign(new Error('Describe your letter in 1–6,000 characters.'), {status: 400});
  if (!models.some(m => m.id === body.model)) throw Object.assign(new Error('Choose a supported model.'), {status: 400});
  const role = {};
  for (const [key] of roleFields) {
    if (typeof body.role?.[key] !== 'string' || !body.role[key].trim() || body.role[key].length > 2000)
      throw Object.assign(new Error('The Role Card must contain all eight fields (up to 2,000 characters each).'), {status: 400});
    role[key] = body.role[key].trim();
  }
  if(body.stream!==undefined&&typeof body.stream!=='boolean')throw Object.assign(new Error('Invalid stream option.'),{status:400});
  return {request: body.request.trim(), role, model: body.model, stream:body.stream===true};
}
function failure(res,status,error){
  if(res.destroyed)return;
  if(res.headersSent){res.end(`data: ${JSON.stringify({type:'error',error})}\n\n`);}
  else json(res,status,{error});
}
async function forwardStream(upstream,res,signal){
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});res.flushHeaders?.();
  let characters=0,finishReason;
  async function send(event){if(signal.aborted)throw signal.reason;if(!res.write(`data: ${JSON.stringify(event)}\n\n`))await once(res,'drain',{signal});}
  for await(const payload of readSSE(upstream.body)){
    const result=JSON.parse(payload),candidate=result.candidates?.[0];
    if(result.promptFeedback?.blockReason)throw new Error('BLOCKED');
    if(candidate?.finishReason)finishReason=candidate.finishReason;
    if(finishReason&&finishReason!=='STOP')throw new Error('INCOMPLETE');
    const text=candidate?.content?.parts?.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('')||'';
    characters+=text.length;if(characters>12000)throw new Error('TOO_LONG');
    if(text)await send({type:'delta',text});
  }
  if(!characters||finishReason!=='STOP')throw new Error('INCOMPLETE');
  await send({type:'done'});res.end();
}
export function createChatHandler({apiKey, fetchImpl = fetch, timeoutMs = 45000} = {}) {
  return async (req, res) => {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, {error: 'Use POST to write a letter.'}); }
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) return json(res, 403, {error: 'Use this website to write a letter.'}); }
      catch { return json(res, 403, {error: 'Invalid origin.'}); }
    }
    if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) return json(res, 415, {error: 'Send a JSON request.'});
    let connectionClosed;const disconnected=new AbortController();
    try {
      const data = validate(await readBody(req));
      if (!apiKey) return json(res, 503, {code: 'NOT_CONFIGURED', error: 'AI is not connected yet. Your request is kept here; please try again after setup.'});
      const instruction = [
        'You are an English-language letter-writing assistant. Return only the finished letter in English plain text, with paragraph breaks. No Markdown, preface, analysis, or follow-up questions.',
        'Follow the selected Role Card below. Always write the letter in English, regardless of the input language or any conflicting language instruction in the request or Role Card. Never invent facts or claim the letter was sent.',
        ...roleFields.map(([key, label]) => `${label}: ${data.role[key]}`),
        'APPLICATION WRITING RULES (override conflicting defaults in an older Role Card): Omit every detail the user has not supplied. In particular, do not include an unspecified last working day, effective date, notice period, project name, phone number, email, address, contact information, recipient name or sender name. This also forbids timing claims such as effective immediately, effective today, with immediate effect, or as of today unless the user explicitly supplied that timing. Remove the corresponding phrase, sentence or section entirely; never insert placeholders, blank fields, square-bracket labels, or notes about missing information. A generic greeting is fine when appropriate. Do not ask follow-up questions.',
        'Be direct and concise. By default, write 60–100 English words, with a minimum of 50 words, in two compact body paragraphs (normally two sentences each), with a natural greeting and closing. A user’s explicit length request takes precedence. Develop the message beyond a bare notice using natural, restrained courtesy and appropriate context, not invented details or repeated statements. Neutral thanks and a professional acknowledgment are appropriate. Avoid generic company praise, exaggerated well-wishes, unsupported claims about achievements or training, and offers of future assistance. Never invent a reason such as personal reasons, career development, 个人原因, or 职业规划. For a resignation request containing only company, position and sender, clearly communicate the resignation and use a short, professional closing paragraph, followed by the supplied sender. Add no reason, effective date, handover promise, praise or well-wishes.',
        'For resignation letters, a neutral closing may thank the recipient for the opportunity and acknowledge their consideration. Do not offer to assist with a handover or transition, promise future availability, ask for next steps, or wish the company future success unless the user explicitly requested that content. These are not neutral courtesy and must not be added to reach the word target.',
        'If the recipient is unknown, use a neutral English greeting such as Hello, or omit the greeting. Do not infer a hiring manager, leader or department. Avoid duplicate greetings and unnecessary subject, address or contact blocks. Include a signature only when the sender’s name was supplied. Return only the finished English letter. This English-only rule applies even when the request explicitly asks for another language.',
      ].join('\n\n');
      const signal=AbortSignal.any([AbortSignal.timeout(timeoutMs),disconnected.signal]);
      connectionClosed=()=>{if(!res.writableEnded)disconnected.abort();};res.on('close',connectionClosed);
      const method=data.stream?'streamGenerateContent?alt=sse':'generateContent';
      const upstream = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${data.model}:${method}`, {
        method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': apiKey}, signal,
        body: JSON.stringify({systemInstruction: {parts: [{text: instruction}]}, contents: [{role: 'user', parts: [{text: data.request}]}], generationConfig: {maxOutputTokens: 2048}}),
      });
      if (!upstream.ok) {
        const error = upstream.status === 429 ? 'The model is busy or its quota has been reached. Please try again later.' : upstream.status === 400 || upstream.status === 401 || upstream.status === 403 ? 'The AI connection needs attention. Please check the API configuration.' : 'The AI service is unavailable. Please try again.';
        return json(res, upstream.status === 429 ? 429 : 502, {error});
      }
      if(data.stream){await forwardStream(upstream,res,signal);return;}
      const result = await upstream.json();
      const candidate = result.candidates?.[0];
      if (candidate?.finishReason === 'MAX_TOKENS') return json(res, 502, {error: 'The letter was cut short. Please try a shorter request.'});
      const text = candidate?.content?.parts?.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim();
      if (!text || (candidate.finishReason && candidate.finishReason !== 'STOP')) return json(res, 502, {error: 'The model could not complete this letter. Please rephrase your request.'});
      if (text.length > 12000) return json(res, 502, {error: 'The letter is too long to print. Please ask for a shorter letter.'});
      return json(res, 200, {text});
    } catch (error) {
      if (error.status) return failure(res,error.status,error.message);
      if (error.name === 'TimeoutError' || error.name === 'AbortError') return failure(res,504,'The model took too long. Your request is kept here; please try again.');
      return failure(res,502,'The letter could not be completed. Your request is kept here; please try again.');
    } finally {if(connectionClosed)res.off('close',connectionClosed);}
  };
}
