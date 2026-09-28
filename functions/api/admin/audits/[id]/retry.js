import {adminGuard} from '../../../../_lib/auth.js';
import {json} from '../../../../_lib/util.js';
import {readJson} from '../../../../_lib/http.js';
import {processAuditNotifications} from '../../../../_lib/notifications.js';
export async function onRequestPost(context){const denied=await adminGuard(context);if(denied)return denied;try{const body=await readJson(context.request,4096),outcomes=await processAuditNotifications(context.env,context.params.id,String(body.deliveryId||''));return json({success:outcomes.every(x=>x.status==='sent'),notifications:outcomes},outcomes.every(x=>x.status==='sent')?200:202)}catch(error){return json({error:error.message||'Nouvelle tentative impossible.'},error.status||400)}}
