import {json} from './util.js';

const AUTH_TIMEOUT_MS=5000;

function bearerToken(request){
  const header=request.headers.get('authorization')||'';
  const match=header.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1]||'';
}

async function supabaseFetch(env,path,token){
  const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'');
  const anonKey=env.SUPABASE_ANON_KEY;
  if(!base||!anonKey)throw new Error('Configuration Supabase indisponible.');
  return fetch(`${base}${path}`,{
    headers:{apikey:anonKey,authorization:`Bearer ${token}`,accept:'application/json'},
    signal:AbortSignal.timeout(AUTH_TIMEOUT_MS),
  });
}

/** Validate a Supabase access token and its app_admins membership on every request. */
export async function requireAdmin(context){
  if(context.data?.adminAuth)return context.data.adminAuth;
  const token=bearerToken(context.request);
  if(!token)return null;
  try{
    const authResponse=await supabaseFetch(context.env,'/auth/v1/user',token);
    if(authResponse.status===401||authResponse.status===403)return null;
    if(!authResponse.ok)throw new Error(`Supabase Auth returned ${authResponse.status}.`);
    const user=await authResponse.json();
    if(!user?.id||!user?.email)return null;
    const membershipResponse=await supabaseFetch(context.env,`/rest/v1/app_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,token);
    if(membershipResponse.status===401)return null;
    if(!membershipResponse.ok)throw new Error(`Admin membership check returned ${membershipResponse.status}.`);
    const memberships=await membershipResponse.json();
    const admin=Array.isArray(memberships)&&memberships.length>0?{id:user.id,email:user.email}:null;
    if(context.data)context.data.adminAuth=admin||{denied:true};
    return admin||{denied:true};
  }catch(error){
    if(error instanceof Error&&error.name==='TimeoutError')throw new Error('Supabase Auth ne répond pas. Réessayez.');
    throw error;
  }
}

export async function adminGuard(context){
  try{
    const admin=await requireAdmin(context);
    if(admin?.denied)return json({error:'Accès administrateur refusé.'},403);
    if(!admin)return json({error:'Authentification administrateur requise.'},401);
    return null;
  }catch(error){
    console.error('admin-auth-unavailable',error instanceof Error?error.message:'unknown');
    return json({error:'Vérification administrateur temporairement indisponible.'},503,{'retry-after':'5'});
  }
}
