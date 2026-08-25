const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) throw new Error('Variables Supabase manquantes');

let requestId;
let leadId;
const headers = (key) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });
const call = async (path, options = {}, key = service) => {
  const response = await fetch(`${url}${path}`, { ...options, headers: { ...headers(key), ...options.headers } });
  const text = await response.text();
  return { response, data: text ? JSON.parse(text) : null };
};

try {
  const payload = {
    submission_id: crypto.randomUUID(), consent: true,
    identity: {
      first_name: 'TEST', last_name: 'Email réel', company_name: 'A&B TEST', email: 'aetbconseil@gmail.com',
      phone: '+22900000000', whatsapp: '+22900000000', country: 'Bénin', city: 'Cotonou', preferred_language: 'français',
    },
    answers: {
      request_types: ['Site vitrine'], objectives: ['Valider les notifications Gmail'],
      vision: 'Test réel de notification administrateur et confirmation client', budget: 'Test', timeline: 'Test immédiat',
    },
  };
  const submitted = await call('/rest/v1/rpc/submit_project_request', { method: 'POST', body: JSON.stringify({ payload }) }, anon);
  if (!submitted.response.ok) throw new Error(`Soumission HTTP ${submitted.response.status}`);
  const project = submitted.data?.[0];
  requestId = project?.id;
  if (!requestId) throw new Error('Demande non créée');

  const invocation = await call('/functions/v1/notify-new-request', {
    method: 'POST', body: JSON.stringify({ requestId, reference: project.reference }),
  }, anon);
  if (invocation.response.status !== 200) throw new Error(`Notification HTTP ${invocation.response.status}: ${JSON.stringify(invocation.data)}`);

  const requests = await call(`/rest/v1/project_requests?id=eq.${requestId}&select=id,lead_id,reference,status`, {}, service);
  if (requests.data?.length !== 1) throw new Error('Demande absente après envoi');
  leadId = requests.data[0].lead_id;
  const deliveries = await call(`/rest/v1/notification_deliveries?request_id=eq.${requestId}&select=notification_type,recipient,status,attempt_count,provider_id,error_message&order=notification_type`, {}, service);
  if (deliveries.data?.length !== 2 || deliveries.data.some((item) => item.status !== 'sent' || item.attempt_count !== 1 || !item.provider_id?.startsWith('gmail-smtp:'))) {
    throw new Error(`Livraisons inattendues : ${JSON.stringify(deliveries.data)}`);
  }

  const retry = await call('/functions/v1/notify-new-request', {
    method: 'POST', body: JSON.stringify({ requestId, reference: project.reference }),
  }, anon);
  if (retry.response.status !== 200) throw new Error(`Nouvelle invocation HTTP ${retry.response.status}`);
  const afterRetry = await call(`/rest/v1/notification_deliveries?request_id=eq.${requestId}&select=notification_type,status,attempt_count,provider_id&order=notification_type`, {}, service);
  if (afterRetry.data.some((item) => item.attempt_count !== 1)) throw new Error('La nouvelle invocation a renvoyé un email déjà envoyé');

  console.log(JSON.stringify({ passed: true, reference: project.reference, provider: invocation.data?.provider,
    requestPreserved: true, duplicateSendPrevented: true,
    notifications: deliveries.data.map(({ notification_type, recipient, status, attempt_count, provider_id }) => ({
      notification_type, recipient, status, attempt_count, provider_id,
    })),
  }, null, 2));
} finally {
  if (requestId) await call(`/rest/v1/project_requests?id=eq.${requestId}`, { method: 'DELETE' }, service).catch(() => {});
  if (leadId) await call(`/rest/v1/leads?id=eq.${leadId}`, { method: 'DELETE' }, service).catch(() => {});
}
