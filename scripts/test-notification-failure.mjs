const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) throw new Error('Variables Supabase manquantes');

const submissionId = crypto.randomUUID();
let requestId;
let leadId;
const headers = (key, extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra });
const call = async (path, options = {}, key = service) => {
  const response = await fetch(`${url}${path}`, { ...options, headers: headers(key, options.headers) });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { response, data };
};

try {
  const payload = {
    submission_id: submissionId,
    consent: true,
    identity: {
      first_name: 'TEST', last_name: 'Échec Resend', company_name: 'A&B TEST',
      email: 'aetbconseil@gmail.com', phone: '+22900000000', whatsapp: '+22900000000',
      country: 'Bénin', city: 'Cotonou', preferred_language: 'français',
    },
    answers: {
      request_types: ['Site vitrine'], objectives: ['Tester la résilience email'],
      vision: 'Simulation contrôlée d’un échec Resend', budget: 'Test', timeline: 'Test',
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
  if (![200, 202].includes(invocation.response.status)) throw new Error(`Fonction HTTP ${invocation.response.status}`);

  const requests = await call(`/rest/v1/project_requests?id=eq.${requestId}&select=id,lead_id,reference,status`, {}, service);
  if (requests.data?.length !== 1) throw new Error('La demande a été perdue après l’échec email');
  leadId = requests.data[0].lead_id;
  const deliveries = await call(`/rest/v1/notification_deliveries?request_id=eq.${requestId}&select=notification_type,recipient,status,attempt_count,error_message&order=notification_type`, {}, service);
  if (deliveries.data?.length !== 2 || deliveries.data.some((item) => item.status !== 'failed' || item.attempt_count !== 1)) {
    throw new Error(`États inattendus : ${JSON.stringify(deliveries.data)}`);
  }
  console.log(JSON.stringify({
    passed: true,
    reference: project.reference,
    requestPreservedAfterFailure: true,
    notifications: deliveries.data.map(({ notification_type, recipient, status, attempt_count }) => ({ notification_type, recipient, status, attempt_count })),
  }, null, 2));
} finally {
  if (requestId) await call(`/rest/v1/project_requests?id=eq.${requestId}`, { method: 'DELETE' }, service).catch(() => {});
  if (leadId) await call(`/rest/v1/leads?id=eq.${leadId}`, { method: 'DELETE' }, service).catch(() => {});
}
