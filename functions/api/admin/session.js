import {adminGuard,requireAdmin} from '../../_lib/auth.js';
import {json} from '../../_lib/util.js';

export async function onRequestGet(context){
  const denied=await adminGuard(context);
  if(denied)return denied;
  const admin=await requireAdmin(context);
  return json({authenticated:true,id:admin.id,email:admin.email});
}

export function onRequestPost(){
  return json({error:'Connectez-vous avec Supabase Auth.'},405,{'allow':'GET'});
}
