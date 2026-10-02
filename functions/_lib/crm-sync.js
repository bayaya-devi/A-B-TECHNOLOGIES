const SYNC_TIMEOUT_MS=8000;

export async function syncConfiguratorRequest(env,{submissionId,identity,answers,consent}){
  const base=String(env.SUPABASE_URL||'').replace(/\/+$/,'');
  const anonKey=String(env.SUPABASE_ANON_KEY||'');
  if(!base||!anonKey)return{status:'pending',error:'Configuration CRM indisponible.'};
  const payload={submission_id:submissionId,consent:consent===true,identity,answers};
  try{
    const response=await fetch(`${base}/rest/v1/rpc/submit_project_request`,{
      method:'POST',
      headers:{apikey:anonKey,authorization:`Bearer ${anonKey}`,'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify({payload}),
      signal:AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
    const body=await response.json().catch(()=>null);
    if(!response.ok)return{status:'pending',error:`CRM indisponible (HTTP ${response.status}).`};
    const row=Array.isArray(body)?body[0]:body;
    if(!row?.reference)return{status:'pending',error:'Le CRM n’a pas confirmé la demande.'};
    return{status:'synced',reference:row.reference};
  }catch(error){
    return{status:'pending',error:error instanceof Error&&error.name==='TimeoutError'?'CRM temporairement indisponible.':'CRM inaccessible.'};
  }
}
