import { randomBytes, randomUUID } from 'node:crypto';

const baseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !anonKey || !serviceKey) throw new Error('Variables Supabase de test absentes.');

const results = [];
const resources = { requestId: null, leadId: null, storagePath: null, authUserIds: [] };
const record = (name, passed, detail = '') => results.push({ name, passed: Boolean(passed), detail });
const assert = (name, condition, detail = '') => {
  record(name, condition, detail);
  if (!condition) throw new Error(`${name}: ${detail || 'échec'}`);
};

async function api(path, { method = 'GET', key = anonKey, token = key, body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { ok: response.ok, status: response.status, data };
}

async function createAuthUser(email, password, makeAdmin = false) {
  const created = await api('/auth/v1/admin/users', {
    method: 'POST', key: serviceKey, token: serviceKey,
    body: { email, password, email_confirm: true, user_metadata: { test_account: true } },
  });
  assert(`création utilisateur TEST ${makeAdmin ? 'admin' : 'non-admin'}`, created.ok && created.data?.id, `HTTP ${created.status}`);
  resources.authUserIds.push(created.data.id);
  if (makeAdmin) {
    const linked = await api('/rest/v1/app_admins', {
      method: 'POST', key: serviceKey, token: serviceKey,
      headers: { Prefer: 'return=representation' },
      body: [{ user_id: created.data.id, display_name: 'Administrateur TEST E2E' }],
    });
    assert('liaison du compte TEST à app_admins', linked.ok && Array.isArray(linked.data) && linked.data.length === 1, `HTTP ${linked.status}`);
  }
  return created.data;
}

async function signIn(email, password) {
  return api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
}

async function cleanup() {
  if (resources.storagePath) {
    await api(`/storage/v1/object/project-documents/${resources.storagePath}`, { method: 'DELETE', key: serviceKey, token: serviceKey });
  }
  if (resources.requestId) {
    await api(`/rest/v1/project_requests?id=eq.${resources.requestId}`, { method: 'DELETE', key: serviceKey, token: serviceKey });
  }
  if (resources.leadId) {
    await api(`/rest/v1/leads?id=eq.${resources.leadId}`, { method: 'DELETE', key: serviceKey, token: serviceKey });
  }
  for (const userId of resources.authUserIds) {
    await api(`/auth/v1/admin/users/${userId}`, { method: 'DELETE', key: serviceKey, token: serviceKey });
  }
}

try {
  const publicPages = await Promise.all([
    fetch('https://bayaya-devi.github.io/A-B-TECHNOLOGIES/configurateur.html'),
    fetch('https://bayaya-devi.github.io/A-B-TECHNOLOGIES/portal-ab-gestion-k9m4x.html'),
    fetch('https://bayaya-devi.github.io/A-B-TECHNOLOGIES/configurateur.js'),
  ]);
  assert('pages de production accessibles', publicPages.every(response => response.ok), publicPages.map(response => response.status).join(','));

  const authUsers = await api('/auth/v1/admin/users?page=1&per_page=100', { key: serviceKey, token: serviceKey });
  const owner = authUsers.data?.users?.find(user => user.email === 'aetbconseil@gmail.com');
  assert('compte A&B présent et confirmé dans Supabase Auth', owner?.email_confirmed_at, owner?.id || 'absent');
  const ownerAdmin = await api(`/rest/v1/app_admins?user_id=eq.${owner.id}&select=user_id`, { key: serviceKey, token: serviceKey });
  assert('compte A&B reconnu dans app_admins', ownerAdmin.ok && ownerAdmin.data?.length === 1, `lignes=${ownerAdmin.data?.length ?? 0}`);

  const suffix = Date.now();
  const adminEmail = `test-admin-${suffix}@example.com`;
  const userEmail = `test-user-${suffix}@example.com`;
  const adminPassword = `Ab!${randomBytes(18).toString('base64url')}9`;
  const userPassword = `Us!${randomBytes(18).toString('base64url')}7`;
  const testAdmin = await createAuthUser(adminEmail, adminPassword, true);
  await createAuthUser(userEmail, userPassword, false);

  const adminLogin = await signIn(adminEmail, adminPassword);
  assert('connexion administrateur par mot de passe', adminLogin.ok && adminLogin.data?.access_token, `HTTP ${adminLogin.status}`);
  let adminToken = adminLogin.data.access_token;
  const nonAdminLogin = await signIn(userEmail, userPassword);
  assert('connexion utilisateur non administrateur', nonAdminLogin.ok && nonAdminLogin.data?.access_token, `HTTP ${nonAdminLogin.status}`);
  const nonAdminToken = nonAdminLogin.data.access_token;

  const answers = {
    request_types: ['Création d’un site vitrine', 'SEO / visibilité Google'],
    objectives: ['Présenter mon entreprise', 'Obtenir plus de clients'],
    current_problem: 'TEST E2E — manque de visibilité et demandes dispersées',
    current_method: 'Téléphone et messagerie',
    success_definition: 'Demandes qualifiées centralisées',
    audience: ['Entreprises', 'Prospects'],
    regions: 'Maroc, France et Afrique francophone',
    main_device: 'Smartphone',
    design_style: ['Moderne', 'Professionnel', 'Premium'],
    desired_feeling: 'Confiance, expertise et simplicité',
    desired_colors: 'Bleu marine et blanc',
    pages: ['Accueil', 'Services', 'FAQ', 'Contact'],
    feature_priorities: { 'Demande de devis': 'Indispensable', WhatsApp: 'Souhaitée' },
    stored_data: ['Clients', 'Messages', 'Documents'],
    accounts_needed: 'Non',
    workflows: 'Demande → validation → rendez-vous → devis',
    integrations: ['Google', 'WhatsApp', 'Email'],
    self_manage: 'Textes, images et demandes',
    google_visibility: 'Oui, Casablanca et à distance',
    security_data: 'Informations personnelles',
    maintenance: 'Maintenance',
    budget: '10 000 à 20 000 DH',
    timeline: '1 à 3 mois',
    must_have: 'Formulaire, WhatsApp et administration',
    future_features: 'Espace client',
    vision: 'TEST E2E — une plateforme claire qui transforme les visiteurs en prospects qualifiés.',
  };
  const submission = await api('/rest/v1/rpc/submit_project_request', {
    method: 'POST', body: {
      payload: {
        identity: {
          first_name: 'TEST', last_name: 'CLIENT E2E', company_name: 'A&B TEST AUTOMATISÉ',
          email: `client-test-${suffix}@example.com`, phone: '+212600000000', whatsapp: '+212600000000',
          country: 'Maroc', city: 'Casablanca', preferred_language: 'français',
        },
        answers, consent: true, submission_id: randomUUID(),
      },
    },
  });
  const request = Array.isArray(submission.data) ? submission.data[0] : null;
  assert('soumission publique réelle du configurateur', submission.ok && request?.id, `HTTP ${submission.status}`);
  resources.requestId = request.id;
  assert('référence AB-AAAA-XXXXXX', /^AB-\d{4}-\d{6}$/.test(request.reference), request.reference);

  resources.storagePath = `${request.id}/test-e2e-${randomUUID()}.png`;
  const uploaded = await api(`/storage/v1/object/project-documents/${resources.storagePath}`, {
    method: 'POST', body: new Uint8Array([137,80,78,71,13,10,26,10]),
    headers: { 'Content-Type': 'image/png', 'x-upsert': 'false' },
  });
  assert('envoi réel d’un fichier privé', uploaded.ok, `HTTP ${uploaded.status}`);
  const attached = await api('/rest/v1/rpc/attach_request_documents', {
    method: 'POST', body: {
      target_request_id: request.id,
      documents: [{ path: resources.storagePath, name: 'test-e2e.png', type: 'image/png', size: 8 }],
    },
  });
  assert('liaison du fichier au dossier client', attached.ok, `HTTP ${attached.status}`);

  const publicList = await api('/rest/v1/project_requests?select=id&limit=10');
  assert('RLS : le public ne liste aucune demande', publicList.ok && Array.isArray(publicList.data) && publicList.data.length === 0, `lignes=${publicList.data?.length ?? 'erreur'}`);
  const nonAdminList = await api('/rest/v1/project_requests?select=id&limit=10', { token: nonAdminToken });
  assert('RLS : le non-admin ne liste aucune demande', nonAdminList.ok && Array.isArray(nonAdminList.data) && nonAdminList.data.length === 0, `lignes=${nonAdminList.data?.length ?? 'erreur'}`);

  const adminList = await api(`/rest/v1/project_requests?id=eq.${request.id}&select=id,lead_id,reference,status,first_name,last_name,company_name,email,request_types,summary,answers,internal_notes,submitted_at`, { token: adminToken });
  const adminRequest = adminList.data?.[0];
  assert('administration : demande visible et dossier ouvrable', adminList.ok && adminRequest?.id === request.id, `lignes=${adminList.data?.length ?? 0}`);
  resources.leadId = adminRequest.lead_id;
  assert('statut initial nouvelle_demande', adminRequest.status === 'nouvelle_demande', adminRequest.status);
  assert('toutes les réponses exploitables dans le dossier', Object.keys(adminRequest.answers || {}).length === Object.keys(answers).length, `${Object.keys(adminRequest.answers || {}).length}/${Object.keys(answers).length}`);

  const leadRows = await api(`/rest/v1/leads?id=eq.${resources.leadId}&select=id,email,first_name,last_name`, { token: adminToken });
  assert('création du prospect relié à la demande', leadRows.ok && leadRows.data?.length === 1, `lignes=${leadRows.data?.length ?? 0}`);
  const answerRows = await api(`/rest/v1/project_answers?request_id=eq.${request.id}&select=id,section_key,answer_data`, { token: adminToken });
  assert('réponses normalisées enregistrées', answerRows.ok && answerRows.data?.length === Object.keys(answers).length, `${answerRows.data?.length ?? 0}/${Object.keys(answers).length}`);

  const statusUpdate = await api(`/rest/v1/project_requests?id=eq.${request.id}`, {
    method: 'PATCH', token: adminToken, headers: { Prefer: 'return=representation' }, body: { status: 'qualified' },
  });
  assert('changement de statut administrateur', statusUpdate.ok && statusUpdate.data?.[0]?.status === 'qualified', `HTTP ${statusUpdate.status}`);
  const history = await api(`/rest/v1/project_status_history?request_id=eq.${request.id}&select=old_status,new_status,actor_id&order=created_at.asc`, { token: adminToken });
  assert('historique automatique des statuts', history.ok && history.data?.some(row => row.old_status === 'nouvelle_demande' && row.new_status === 'qualified' && row.actor_id === testAdmin.id), JSON.stringify(history.data));

  const internalNoteText = 'TEST E2E — note interne vérifiée automatiquement';
  const noteInsert = await api('/rest/v1/admin_notes', {
    method: 'POST', token: adminToken, headers: { Prefer: 'return=representation' },
    body: [{ request_id: request.id, author_id: testAdmin.id, note: internalNoteText }],
  });
  assert('ajout d’une note interne normalisée', noteInsert.ok && noteInsert.data?.length === 1, `HTTP ${noteInsert.status}`);
  const legacyNote = await api(`/rest/v1/project_requests?id=eq.${request.id}`, {
    method: 'PATCH', token: adminToken, headers: { Prefer: 'return=representation' }, body: { internal_notes: internalNoteText },
  });
  assert('enregistrement de la note affichée par portail CRM', legacyNote.ok && legacyNote.data?.[0]?.internal_notes === internalNoteText, `HTTP ${legacyNote.status}`);
  const noteRead = await api(`/rest/v1/admin_notes?request_id=eq.${request.id}&select=note,author_id`, { token: adminToken });
  assert('consultation de la note interne', noteRead.ok && noteRead.data?.[0]?.note === internalNoteText, `lignes=${noteRead.data?.length ?? 0}`);

  const fileRows = await api(`/rest/v1/request_documents?request_id=eq.${request.id}&select=storage_path,original_name,mime_type,size_bytes`, { token: adminToken });
  assert('fichier affichable dans le dossier admin', fileRows.ok && fileRows.data?.length === 1, `lignes=${fileRows.data?.length ?? 0}`);
  const signed = await api(`/storage/v1/object/sign/project-documents/${resources.storagePath}`, { method: 'POST', token: adminToken, body: { expiresIn: 60 } });
  assert('création d’une URL privée temporaire par un admin', signed.ok && (signed.data?.signedURL || signed.data?.signedUrl), `HTTP ${signed.status}`);
  const publicFile = await api(`/storage/v1/object/project-documents/${resources.storagePath}`);
  assert('RLS Storage : téléchargement public rejeté', !publicFile.ok, `HTTP ${publicFile.status}`);
  const nonAdminFile = await api(`/storage/v1/object/sign/project-documents/${resources.storagePath}`, { method: 'POST', token: nonAdminToken, body: { expiresIn: 60 } });
  assert('RLS Storage : URL signée non-admin rejetée', !nonAdminFile.ok, `HTTP ${nonAdminFile.status}`);

  const nonAdminUpdate = await api(`/rest/v1/project_requests?id=eq.${request.id}`, {
    method: 'PATCH', token: nonAdminToken, headers: { Prefer: 'return=representation' }, body: { status: 'won' },
  });
  assert('RLS : changement de statut non-admin impossible', nonAdminUpdate.ok && Array.isArray(nonAdminUpdate.data) && nonAdminUpdate.data.length === 0, `HTTP ${nonAdminUpdate.status}`);

  const loggedOut = await api('/auth/v1/logout?scope=local', { method: 'POST', token: adminToken });
  assert('déconnexion locale administrateur', loggedOut.ok, `HTTP ${loggedOut.status}`);
  const adminRelogin = await signIn(adminEmail, adminPassword);
  assert('reconnexion administrateur par mot de passe', adminRelogin.ok && adminRelogin.data?.access_token, `HTTP ${adminRelogin.status}`);
  adminToken = adminRelogin.data.access_token;
  const afterRelogin = await api(`/rest/v1/project_requests?id=eq.${request.id}&select=id,reference,status`, { token: adminToken });
  assert('accès au dossier après reconnexion', afterRelogin.ok && afterRelogin.data?.length === 1, `lignes=${afterRelogin.data?.length ?? 0}`);

  const notification = await api(`/rest/v1/notification_deliveries?request_id=eq.${request.id}&select=status,recipient`, { token: adminToken });
  record('notification créée après enregistrement', notification.ok && notification.data?.[0]?.status === 'pending', notification.data?.[0]?.status || 'absente');
} catch (error) {
  record('suite de test interrompue', false, error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
  record('nettoyage des comptes et données TEST', true, 'terminé');
  const failed = results.filter(result => !result.passed);
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exitCode = 1;
}
