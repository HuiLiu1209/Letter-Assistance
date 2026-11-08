// Shared by the browser and Node proxy. TCP chunks are not SSE event boundaries.
export async function* readSSE(body) {
  if (!body) throw new Error('The response has no stream.');
  const reader=body.getReader(),decoder=new TextDecoder();let buffer='',ended=false;
  function data(event) {const lines=event.split('\n').filter(line=>line.startsWith('data:'));return lines.map(line=>line.slice(5).replace(/^ /,'')).join('\n');}
  try {
    while(true) {
      const {value,done}=await reader.read();
      buffer+=(done?decoder.decode():decoder.decode(value,{stream:true}));buffer=buffer.replace(/\r\n/g,'\n');
      if(buffer.length>256*1024)throw new Error('The stream event is too large.');
      let split;
      while((split=buffer.indexOf('\n\n'))!==-1){const event=buffer.slice(0,split);buffer=buffer.slice(split+2);const payload=data(event);if(payload)yield payload;}
      if(done){ended=true;if(buffer.trim())throw new Error('The stream ended inside an event.');break;}
    }
  } finally {if(!ended)await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function* letterDeltas(response) {
  if(!response.ok){let error;try{error=await response.json();}catch{}throw new Error(error?.error||'The AI connection is unavailable. Please try again.');}
  let complete=false;
  for await(const payload of readSSE(response.body)) {
    let event;try{event=JSON.parse(payload);}catch{throw new Error('The AI response stream was invalid. Please try again.');}
    if(event.type==='error')throw new Error(event.error||'The letter could not be completed.');
    if(event.type==='delta'&&typeof event.text==='string'&&event.text){if(complete)throw new Error('Unexpected text after the letter finished.');yield event.text;}
    else if(event.type==='done')complete=true;
  }
  if(!complete)throw new Error('The connection ended before the letter was complete. Your request is kept here; please try again.');
}
