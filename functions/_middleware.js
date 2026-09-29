const SENSITIVE_PAGES=new Set(['/audits-express-admin.html','/portal-ab-gestion-k9m4x.html']);
const INTERNAL_PATHS=[/^\/(?:scripts|supabase|functions|node_modules)(?:\/|$)/,/^\/(?:wrangler\.jsonc|package(?:-lock)?\.json|README(?:-[^/]*)?\.md|supabase-config\.example\.js)$/i,/\.ps1$/i,/\.sql$/i];

export async function onRequest({request,next}){
  const pathname=new URL(request.url).pathname;
  const blocked=INTERNAL_PATHS.some(pattern=>pattern.test(pathname));
  const response=blocked?new Response('Not found',{status:404}):await next();
  const headers=new Headers(response.headers);
  headers.set('x-content-type-options','nosniff');
  headers.set('x-frame-options','DENY');
  headers.set('referrer-policy','strict-origin-when-cross-origin');
  headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');
  if(new URL(request.url).protocol==='https:')headers.set('strict-transport-security','max-age=31536000');
  if(pathname.startsWith('/api/')||SENSITIVE_PAGES.has(pathname))headers.set('cache-control','no-store');
  else if(pathname==='/'||pathname.endsWith('.html'))headers.set('cache-control','no-cache, must-revalidate');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
