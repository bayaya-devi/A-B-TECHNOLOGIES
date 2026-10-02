import {cleanEmail,cleanPhone,cleanText,clientIp,json,sha256} from '../../_lib/util.js';
import {corsHeaders,isAllowedRequestOrigin,optionsResponse,readJson} from '../../_lib/http.js';
import {processConfiguratorNotifications} from '../../_lib/configurator-notifications.js';
import {syncConfiguratorRequest} from '../../_lib/crm-sync.js';

const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function bounded(value,max=20000){const text=JSON.stringify(value??{});if(text.length>max)throw new Error('Les réponses sont trop volumineuses.');return JSON.parse(text)}

export function onRequestOptions({request}){return optionsResponse(request)}
export async function onRequestPost(context){
  const {request,env}=context,headers=corsHeaders(request);
  if(!isAllowedRequestOrigin(request))return json({error:'Origine non autorisée.'},403);
  try{
    const body=await readJson(request,65536);
    if(cleanText(body.websiteConfirm,100))return json({accepted:true},202,headers);
    if(!uuid(body.submissionId))throw new Error('Identifiant de soumission invalide.');
    const existing=await env.AUDIT_DB.prepare('SELECT id,reference,first_name,last_name,company_name,email,phone,whatsapp,country,city,preferred_language,request_types,answers FROM configurator_requests WHERE submission_key=?').bind(body.submissionId).first();
    if(existing){
      const crm=await syncConfiguratorRequest(env,{submissionId:body.submissionId,identity:{first_name:existing.first_name,last_name:existing.last_name,company_name:existing.company_name||'',email:existing.email,phone:existing.phone||'',whatsapp:existing.whatsapp||'',country:existing.country,city:existing.city||'',preferred_language:existing.preferred_language||'français'},answers:{...JSON.parse(existing.answers||'{}'),request_types:JSON.parse(existing.request_types||'[]'),consent:true},consent:true});
      return json({success:true,reference:existing.reference,crmReference:crm.reference||null,crmSync:crm.status,duplicate:true},200,headers);
    }
    const raw=bounded(body.payload),identity=raw.identity&&typeof raw.identity==='object'?raw.identity:{},answers=bounded(raw.answers);
    if(raw.consent!==true||answers.consent!==true)throw new Error('Votre accord est nécessaire pour envoyer la demande.');
    const firstName=cleanText(identity.first_name,100,true),lastName=cleanText(identity.last_name,100,true),companyName=cleanText(identity.company_name,180),email=cleanEmail(identity.email),phone=cleanPhone(identity.phone),whatsapp=cleanPhone(identity.whatsapp||'',false),country=cleanText(identity.country,100,true),city=cleanText(identity.city,100),language=cleanText(identity.preferred_language,40),types=Array.isArray(answers.request_types)?answers.request_types.map(value=>cleanText(value,120)).filter(Boolean):[];
    if(!types.length)throw new Error('Sélectionnez au moins un type de projet.');
    const fingerprint=await sha256(`${clientIp(request)}|${env.AUDIT_RATE_LIMIT_SALT}`),since=new Date(Date.now()-3600000).toISOString(),recent=await env.AUDIT_DB.prepare('SELECT COUNT(*) AS total FROM configurator_submission_limits WHERE fingerprint_hash=? AND created_at>=?').bind(fingerprint,since).first();
    if(Number(recent?.total||0)>=5)return json({error:'Trop de demandes récentes. Réessayez dans une heure.'},429,headers);
    const now=new Date().toISOString(),year=new Date().getUTCFullYear(),id=crypto.randomUUID(),counter=await env.AUDIT_DB.prepare('INSERT INTO configurator_reference_counters(year,last_number) VALUES(?,1) ON CONFLICT(year) DO UPDATE SET last_number=last_number+1 RETURNING last_number').bind(year).first(),reference=`AB-${year}-${String(counter.last_number).padStart(6,'0')}`,adminId=crypto.randomUUID(),clientId=crypto.randomUUID();
    await env.AUDIT_DB.batch([
      env.AUDIT_DB.prepare('INSERT INTO configurator_submission_limits(fingerprint_hash,created_at) VALUES(?,?)').bind(fingerprint,now),
      env.AUDIT_DB.prepare('INSERT INTO configurator_requests(id,reference,submission_key,first_name,last_name,company_name,email,phone,whatsapp,country,city,preferred_language,request_types,answers,consent_at,submitted_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,reference,body.submissionId,firstName,lastName,companyName||null,email,phone,whatsapp||null,country,city||null,language||null,JSON.stringify(types),JSON.stringify(answers),now,now,now),
      env.AUDIT_DB.prepare('INSERT INTO configurator_notification_deliveries(id,request_id,notification_type,recipient,status,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(adminId,id,'admin',env.ADMIN_EMAIL,'pending',crypto.randomUUID(),now,now),
      env.AUDIT_DB.prepare('INSERT INTO configurator_notification_deliveries(id,request_id,notification_type,recipient,status,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(clientId,id,'client',email,'pending',crypto.randomUUID(),now,now)
    ]);
    const crm=await syncConfiguratorRequest(env,{submissionId:body.submissionId,identity,answers,consent:true});
    context.waitUntil(processConfiguratorNotifications(env,id).catch(()=>{}));
    return json({success:true,reference,crmReference:crm.reference||null,crmSync:crm.status,notifications:[{type:'admin',status:'pending'},{type:'client',status:'pending'}]},201,headers);
  }catch(error){return json({error:error instanceof Error?error.message:'Demande invalide.'},error?.status||400,headers)}
}
