import {json} from './util.js';

function requestError(message,status=400){return Object.assign(new Error(message),{status})}

const ALLOWED_ORIGINS=new Set([
  'https://a-b-technologies.pages.dev',
  'https://bayaya-devi.github.io',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
]);

export function isAllowedRequestOrigin(request){
  const origin=request.headers.get('origin');
  return !origin||ALLOWED_ORIGINS.has(origin);
}

export function corsHeaders(request,methods='POST, OPTIONS'){
  const origin=request.headers.get('origin');
  if(!origin||!ALLOWED_ORIGINS.has(origin))return {};
  return {
    'access-control-allow-origin':origin,
    'access-control-allow-headers':'content-type',
    'access-control-allow-methods':methods,
    'vary':'Origin',
  };
}

export function optionsResponse(request){
  if(!isAllowedRequestOrigin(request))return json({error:'Origine non autorisée.'},403);
  return new Response(null,{status:204,headers:corsHeaders(request)});
}

/** Parse a bounded JSON request body, including requests without Content-Length. */
export async function readJson(request,maxBytes=65536){
  const declaredLength=Number(request.headers.get('content-length')||0);
  if(declaredLength>maxBytes)throw requestError('Requête trop volumineuse.',413);
  if(!request.body)throw requestError('Corps JSON manquant.');
  const reader=request.body.getReader(),chunks=[];
  let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>maxBytes){await reader.cancel();throw requestError('Requête trop volumineuse.',413);}
      chunks.push(value);
    }
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}
  catch{throw requestError('Corps JSON invalide.')}
}
