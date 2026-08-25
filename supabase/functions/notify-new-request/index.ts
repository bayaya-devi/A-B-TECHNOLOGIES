import { createClient } from 'jsr:@supabase/supabase-js@2';

const ADMIN_EMAIL = 'aetbconseil@gmail.com';
const ADMIN_URL = 'https://bayaya-devi.github.io/A-B-TECHNOLOGIES/admin.html';
const allowedOrigins = new Set(['https://bayaya-devi.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000']);
type EmailMessage = { to: string; subject: string; html: string };

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://bayaya-devi.github.io',
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

function display(value: unknown, fallback = 'Non renseigné') {
  if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
  const text = String(value ?? '').trim();
  return text || fallback;
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function encodeBase64Url(value: string) {
  return encodeBase64(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

async function sendWithGmail(message: EmailMessage) {
  const clientId = Deno.env.get('GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Configuration Gmail OAuth incomplète');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token.access_token) {
    throw new Error(token?.error_description || token?.error || `Google OAuth HTTP ${tokenResponse.status}`);
  }

  const mime = [
    `From: A&B Technologies <${ADMIN_EMAIL}>`,
    `To: ${message.to}`,
    `Subject: =?UTF-8?B?${encodeBase64(message.subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.html,
  ].join('\r\n');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encodeBase64Url(mime) }),
  });
  const provider = await response.json().catch(() => ({}));
  if (!response.ok || !provider.id) throw new Error(provider?.error?.message || `Gmail API HTTP ${response.status}`);
  return `gmail:${provider.id}`;
}

async function sendWithResend(message: EmailMessage) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('NOTIFICATION_FROM_EMAIL');
  if (!apiKey || !from) throw new Error('Configuration Resend incomplète');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html }),
  });
  const provider = await response.json().catch(() => ({}));
  if (!response.ok || !provider.id) throw new Error(provider?.message || `Resend HTTP ${response.status}`);
  return `resend:${provider.id}`;
}

Deno.serve(async (request) => {
  const headers = cors(request.headers.get('origin'));
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Méthode refusée' }), { status: 405, headers });

  try {
    const { requestId, reference } = await request.json();
    if (!requestId || !reference) return new Response(JSON.stringify({ error: 'Demande invalide' }), { status: 400, headers });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    // Supabase est toujours relu après la transaction d'enregistrement.
    const { data: project, error: projectError } = await admin
      .from('project_requests')
      .select('id,reference,first_name,last_name,company_name,email,phone,whatsapp,request_types,summary,submitted_at')
      .eq('id', requestId)
      .eq('reference', reference)
      .maybeSingle();
    if (projectError || !project) return new Response(JSON.stringify({ error: 'Demande inconnue' }), { status: 404, headers });

    const { data: deliveries, error: deliveryError } = await admin
      .from('notification_deliveries')
      .select('id,notification_type,recipient,status,attempt_count')
      .eq('request_id', requestId)
      .order('notification_type');
    if (deliveryError || !deliveries?.length) {
      return new Response(JSON.stringify({ accepted: true, stored: true, notifications: [] }), { status: 202, headers });
    }

    const gmailConfigured = Boolean(Deno.env.get('GMAIL_CLIENT_ID') && Deno.env.get('GMAIL_CLIENT_SECRET') && Deno.env.get('GMAIL_REFRESH_TOKEN'));
    const resendConfigured = Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('NOTIFICATION_FROM_EMAIL'));
    const preferred = (Deno.env.get('EMAIL_PROVIDER') || 'gmail').toLowerCase();
    const provider = preferred === 'resend' && resendConfigured ? 'resend' : gmailConfigured ? 'gmail' : resendConfigured ? 'resend' : null;
    if (!provider) {
      return new Response(JSON.stringify({ accepted: true, stored: true, notification: 'pending_provider_configuration' }), { status: 202, headers });
    }

    const summary = project.summary && typeof project.summary === 'object' ? project.summary : {};
    const fullName = `${project.first_name} ${project.last_name}`.trim();
    const adminLink = `${ADMIN_URL}?reference=${encodeURIComponent(project.reference)}`;
    const messages: Record<string, EmailMessage> = {
      admin: {
        to: ADMIN_EMAIL,
        subject: `Nouvelle demande ${project.reference} — A&B Technologies`,
        html: `<h2>Nouvelle demande projet</h2>
          <p><strong>Référence :</strong> ${escapeHtml(project.reference)}</p>
          <p><strong>Client :</strong> ${escapeHtml(fullName)}</p>
          <p><strong>Entreprise :</strong> ${escapeHtml(display(project.company_name))}</p>
          <p><strong>Email :</strong> ${escapeHtml(project.email)}</p>
          <p><strong>Téléphone :</strong> ${escapeHtml(display(project.phone))}</p>
          <p><strong>WhatsApp :</strong> ${escapeHtml(display(project.whatsapp))}</p>
          <p><strong>Type de projet :</strong> ${escapeHtml(display(project.request_types))}</p>
          <p><strong>Objectifs principaux :</strong> ${escapeHtml(display(summary.objectives))}</p>
          <p><strong>Budget :</strong> ${escapeHtml(display(summary.budget))}</p>
          <p><strong>Délai :</strong> ${escapeHtml(display(summary.timeline))}</p>
          <p><strong>Résumé :</strong> ${escapeHtml(display(summary.vision))}</p>
          <p><strong>Date de soumission :</strong> ${escapeHtml(new Date(project.submitted_at).toLocaleString('fr-FR', { timeZone: 'Africa/Lagos' }))}</p>
          <p><a href="${escapeHtml(adminLink)}">Ouvrir l’administration A&B</a> puis rechercher <strong>${escapeHtml(project.reference)}</strong>.</p>`,
      },
      client: {
        to: project.email,
        subject: `Votre demande ${project.reference} a bien été reçue`,
        html: `<h2>Merci ${escapeHtml(project.first_name)}</h2>
          <p>Nous confirmons la réception de votre demande auprès d’A&amp;B Technologies.</p>
          <p>Votre référence est <strong>${escapeHtml(project.reference)}</strong>.</p>
          <p>Les prochaines étapes sont :</p>
          <p>analyse de la demande → prise de contact → rendez-vous à distance → éventuel mini-audit → devis.</p>
          <p>Merci pour votre confiance.</p>`,
      },
    };

    const outcomes = [];
    for (const delivery of deliveries) {
      if (delivery.status === 'sent') {
        outcomes.push({ type: delivery.notification_type, status: 'sent' });
        continue;
      }
      const message = messages[delivery.notification_type];
      try {
        if (!message || delivery.recipient.toLowerCase() !== message.to.toLowerCase()) {
          throw new Error('Destinataire ou type de notification incohérent');
        }
        const providerId = provider === 'gmail' ? await sendWithGmail(message) : await sendWithResend(message);
        await admin.from('notification_deliveries').update({
          status: 'sent', attempted_at: new Date().toISOString(), attempt_count: (delivery.attempt_count ?? 0) + 1,
          provider_id: providerId, error_message: null,
        }).eq('id', delivery.id);
        outcomes.push({ type: delivery.notification_type, status: 'sent' });
      } catch (error) {
        await admin.from('notification_deliveries').update({
          status: 'failed', attempted_at: new Date().toISOString(), attempt_count: (delivery.attempt_count ?? 0) + 1,
          error_message: String(error instanceof Error ? error.message : 'Erreur du fournisseur').slice(0, 1000),
        }).eq('id', delivery.id);
        outcomes.push({ type: delivery.notification_type, status: 'failed' });
      }
    }
    const allSent = outcomes.length > 0 && outcomes.every((item) => item.status === 'sent');
    return new Response(JSON.stringify({ accepted: true, stored: true, provider, notifications: outcomes }), { status: allSent ? 200 : 202, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur interne' }), { status: 500, headers });
  }
});
