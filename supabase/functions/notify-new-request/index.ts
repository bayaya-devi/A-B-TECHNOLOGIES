import { createClient } from 'jsr:@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://bayaya-devi.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);

function cors(origin: string | null) {
  const accepted = origin && allowedOrigins.has(origin) ? origin : 'https://bayaya-devi.github.io';
  return {
    'Access-Control-Allow-Origin': accepted,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
}

Deno.serve(async (request) => {
  const headers = cors(request.headers.get('origin'));
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Méthode refusée' }), { status: 405, headers });

  try {
    const { requestId, reference } = await request.json();
    if (!requestId || !reference) {
      return new Response(JSON.stringify({ error: 'Demande invalide' }), { status: 400, headers });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: project, error: projectError } = await admin
      .from('project_requests')
      .select('id,reference,first_name,last_name,company_name,email,phone,request_types,summary,submitted_at')
      .eq('id', requestId)
      .eq('reference', reference)
      .maybeSingle();
    if (projectError || !project) {
      return new Response(JSON.stringify({ error: 'Demande inconnue' }), { status: 404, headers });
    }

    const { data: delivery } = await admin
      .from('notification_deliveries')
      .select('id,status')
      .eq('request_id', requestId)
      .eq('channel', 'email')
      .maybeSingle();
    if (!delivery || delivery.status === 'sent') {
      return new Response(JSON.stringify({ accepted: true, notification: delivery?.status ?? 'not_required' }), { status: 200, headers });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL') || 'A&B Technologies <onboarding@resend.dev>';
    if (!resendKey) {
      return new Response(JSON.stringify({ accepted: true, stored: true, notification: 'pending_provider_configuration' }), { status: 202, headers });
    }

    const types = Array.isArray(project.request_types) ? project.request_types.join(', ') : 'Non précisé';
    const sendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: ['aetbconseil@gmail.com'],
        subject: `Nouvelle demande ${project.reference} — A&B Technologies`,
        html: `<h2>Nouvelle demande projet</h2>
          <p><strong>Référence :</strong> ${escapeHtml(project.reference)}</p>
          <p><strong>Client :</strong> ${escapeHtml(project.first_name)} ${escapeHtml(project.last_name)}</p>
          <p><strong>Entreprise :</strong> ${escapeHtml(project.company_name || 'Non précisée')}</p>
          <p><strong>Email :</strong> ${escapeHtml(project.email)}</p>
          <p><strong>Téléphone :</strong> ${escapeHtml(project.phone || 'Non précisé')}</p>
          <p><strong>Demande :</strong> ${escapeHtml(types)}</p>
          <p><strong>Vision :</strong> ${escapeHtml(project.summary?.vision || 'Non précisée')}</p>
          <p>Consultez le dossier complet dans l’administration A&B Technologies.</p>`,
      }),
    });
    const provider = await sendResponse.json();
    if (!sendResponse.ok) {
      await admin.from('notification_deliveries').update({
        status: 'failed', attempted_at: new Date().toISOString(), error_message: provider?.message || 'Erreur du fournisseur',
      }).eq('id', delivery.id);
      return new Response(JSON.stringify({ accepted: true, stored: true, notification: 'failed' }), { status: 202, headers });
    }

    await admin.from('notification_deliveries').update({
      status: 'sent', attempted_at: new Date().toISOString(), provider_id: provider.id, error_message: null,
    }).eq('id', delivery.id);
    return new Response(JSON.stringify({ accepted: true, stored: true, notification: 'sent' }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur interne' }), { status: 500, headers });
  }
});
