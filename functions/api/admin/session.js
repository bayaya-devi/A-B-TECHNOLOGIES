import {authenticateAdmin,clearSessionCookie,createSession,requireAdmin,sessionCookie} from '../../_lib/auth.js';
import {cleanEmail,cleanText,json} from '../../_lib/util.js';
export async function onRequestGet(context){const admin=await requireAdmin(context);return admin?json({authenticated:true,email:admin.email}):json({authenticated:false},401)}
export async function onRequestPost(context){try{const body=await context.request.json(),email=cleanEmail(body.email),password=cleanText(body.password,200,true),result=await authenticateAdmin(context,email,password);if(!result.ok)return json({error:result.error},result.status);const token=await createSession(email,context.env);return json({authenticated:true,email},200,{'set-cookie':sessionCookie(token)})}catch{return json({error:'Connexion impossible.'},400)}}
export function onRequestDelete(){return json({authenticated:false},200,{'set-cookie':clearSessionCookie()})}
