import {adminGuard,requireAdmin} from '../../../../_lib/auth.js';
import {cleanText,json} from '../../../../_lib/util.js';
import {readJson} from '../../../../_lib/http.js';
export async function onRequestPost(context){const denied=await adminGuard(context);if(denied)return denied;try{const body=await readJson(context.request,8192),note=cleanText(body.note,5000,true),admin=await requireAdmin(context),now=new Date().toISOString();await context.env.AUDIT_DB.prepare('INSERT INTO audit_notes(audit_id,author,note,created_at) VALUES(?,?,?,?)').bind(context.params.id,admin.email,note,now).run();return json({success:true})}catch(error){return json({error:error.message||'Note invalide.'},error.status||400)}}
