import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@^9';

const ADMIN_EMAIL = 'aetbconseil@gmail.com';
const allowedOrigins = new Set(['https://bayaya-devi.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000']);
const allowedTypes = new Set(['general_email','appointment_proposal','information_request','quote','follow_up']);

function response(origin: string | null, body: unknown, status = 200) {
  const accepted = origin && allowedOrigins.has(origin) ? origin : 'https://bayaya-devi.github.io';
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json', 'Access-Control-Allow-Origin': accepted,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin',
  }});
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] ?? c));
}

function validUuid(value: unknown) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return response(origin, {}, 204);
  if (request.method !== 'POST') return response(origin, { error: 'Méthode refusée' }, 405);

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return response(origin, { error: 'Authentification requise' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return response(origin, { error: 'Session invalide' }, 401);
  const { data: membership } = await admin.from('app_admins').select('user_id').eq('user_id', authData.user.id).maybeSingle();
  if (!membership) return response(origin, { error: 'Accès administrateur refusé' }, 403);

  let communicationId: string | null = null;
  let appointmentId: string | null = null;
  try {
    const input = await request.json();
    if (!validUuid(input.requestId)) return response(origin, { error: 'Dossier invalide' }, 400);
    const { data: project } = await admin.from('project_requests')
      .select('id,lead_id,reference,first_name,last_name,email,status').eq('id', input.requestId).maybeSingle();
    if (!project) return response(origin, { error: 'Dossier inconnu' }, 404);

    let communication: any;
    if (input.retryCommunicationId) {
      if (!validUuid(input.retryCommunicationId)) return response(origin, { error: 'Communication invalide' }, 400);
      const { data: existing } = await admin.from('communications').select('*')
        .eq('id', input.retryCommunicationId).eq('project_request_id', project.id).maybeSingle();
      if (!existing) return response(origin, { error: 'Communication inconnue' }, 404);
      if (existing.status === 'sent') return response(origin, { communication: existing, idempotent: true });
      if (!['failed','pending'].includes(existing.status)) return response(origin, { error: 'Envoi déjà en cours' }, 409);
      const { data: claimed } = await admin.from('communications').update({
        status: 'processing', attempted_at: new Date().toISOString(), failed_at: null,
        error_message: null, attempt_count: existing.attempt_count + 1,
      }).eq('id', existing.id).eq('status', existing.status).select().maybeSingle();
      if (!claimed) return response(origin, { error: 'Envoi déjà repris' }, 409);
      communication = claimed;
    } else {
      if (!allowedTypes.has(input.type)) return response(origin, { error: 'Type d’email invalide' }, 400);
      const subject = String(input.subject || '').trim();
      const body = String(input.body || '').trim();
      if (!subject || subject.length > 300 || !body || body.length > 50000) return response(origin, { error: 'Objet ou message invalide' }, 400);
      if (!validUuid(input.idempotencyKey)) return response(origin, { error: 'Clé d’envoi invalide' }, 400);

      if (input.type === 'appointment_proposal') {
        const slots = Array.isArray(input.appointment?.slots) ? input.appointment.slots.slice(0, 5) : [];
        if (!slots.length || slots.some((slot: any) => !slot?.startsAt || Number.isNaN(Date.parse(slot.startsAt)))) {
          return response(origin, { error: 'Créneaux invalides' }, 400);
        }
        const mode = ['Visio','Téléphone','Autre'].includes(input.appointment?.mode) ? input.appointment.mode : 'Visio';
        const duration = Math.min(480, Math.max(5, Number(input.appointment?.durationMinutes || 30)));
        const { data: appointment, error: appointmentError } = await admin.from('appointments').insert({
          request_id: project.id, lead_id: project.lead_id, starts_at: slots[0].startsAt,
          status: 'draft', mode, duration_minutes: duration, notes: String(input.appointment?.notes || '').slice(0, 2000),
          created_by: authData.user.id,
        }).select().single();
        if (appointmentError) throw appointmentError;
        appointmentId = appointment.id;
        const { error: slotsError } = await admin.from('appointment_slots').insert(slots.map((slot: any) => ({
          appointment_id: appointment.id, starts_at: slot.startsAt, status: 'proposed',
        })));
        if (slotsError) throw slotsError;
      }

      let quote: any = null;
      if (input.type === 'quote') {
        if (!validUuid(input.quoteId)) return response(origin, { error: 'Devis invalide' }, 400);
        const { data } = await admin.from('quotes').select('*').eq('id', input.quoteId).eq('project_request_id', project.id).maybeSingle();
        if (!data || data.status !== 'draft') return response(origin, { error: 'Devis indisponible' }, 400);
        quote = data;
      }

      const record = {
        project_request_id: project.id, lead_id: project.lead_id, quote_id: quote?.id || null,
        appointment_id: appointmentId, type: input.type, recipient_email: project.email,
        subject, body, status: 'processing', provider: 'gmail-smtp', attachment_path: quote?.storage_path || null,
        sent_by: authData.user.id, idempotency_key: input.idempotencyKey, attempt_count: 1,
        attempted_at: new Date().toISOString(),
      };
      const { data: created, error: createError } = await admin.from('communications').insert(record).select().single();
      if (createError?.code === '23505') {
        const { data: existing } = await admin.from('communications').select('*').eq('idempotency_key', input.idempotencyKey).maybeSingle();
        if (existing?.status === 'sent') return response(origin, { communication: existing, idempotent: true });
        return response(origin, { error: 'Envoi déjà en cours ou enregistré' }, 409);
      }
      if (createError) throw createError;
      communication = created;
    }
    communicationId = communication.id;

    const attachments = [];
    if (communication.attachment_path) {
      const { data: quote } = await admin.from('quotes').select('filename,storage_path').eq('storage_path', communication.attachment_path).maybeSingle();
      if (!quote) throw new Error('Pièce jointe du devis introuvable');
      const { data: file, error: fileError } = await admin.storage.from('crm-documents').download(quote.storage_path);
      if (fileError || !file) throw new Error('Téléchargement privé du devis impossible');
      attachments.push({ filename: quote.filename, content: new Uint8Array(await file.arrayBuffer()), contentType: 'application/pdf' });
    }

    const password = Deno.env.get('GMAIL_APP_PASSWORD');
    if (!password) throw new Error('Gmail SMTP non configuré');
    const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: ADMIN_EMAIL, pass: password } });
    const mail = await transport.sendMail({
      from: `A&B Technologies <${ADMIN_EMAIL}>`, replyTo: ADMIN_EMAIL,
      to: communication.recipient_email, subject: communication.subject, text: communication.body,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#172033">${escapeHtml(communication.body).replaceAll('\n','<br>')}</div>`,
      attachments,
    });
    if (!mail?.messageId) throw new Error('Gmail n’a retourné aucun identifiant');

    const now = new Date().toISOString();
    const { data: sent } = await admin.from('communications').update({
      status: 'sent', provider: 'gmail-smtp', provider_message_id: mail.messageId,
      sent_at: now, failed_at: null, error_message: null,
    }).eq('id', communication.id).select().single();

    if (communication.type === 'appointment_proposal' && communication.appointment_id) {
      await admin.from('appointments').update({ status: 'proposed' }).eq('id', communication.appointment_id);
      await admin.from('project_requests').update({ status: 'rdv_propose' }).eq('id', project.id);
    }
    if (communication.type === 'quote' && communication.quote_id) {
      await admin.from('quotes').update({ status: 'sent', sent_at: now }).eq('id', communication.quote_id);
      await admin.from('project_requests').update({ status: 'devis_envoye' }).eq('id', project.id);
    }
    await admin.from('crm_activity').insert({
      project_request_id: project.id, lead_id: project.lead_id, actor_id: authData.user.id,
      event_type: `${communication.type}_sent`, title: `Email envoyé — ${communication.subject}`,
      details: { communication_id: communication.id },
    });
    return response(origin, { communication: sent, provider: 'gmail-smtp' });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : 'Erreur interne').slice(0, 1000);
    if (communicationId) {
      const now = new Date().toISOString();
      const { data: failed } = await admin.from('communications').update({ status: 'failed', failed_at: now, error_message: message })
        .eq('id', communicationId).select('project_request_id,lead_id,sent_by,subject').maybeSingle();
      if (failed) await admin.from('crm_activity').insert({
        project_request_id: failed.project_request_id, lead_id: failed.lead_id, actor_id: failed.sent_by,
        event_type: 'email_failed', title: `Échec email — ${failed.subject}`, details: { communication_id: communicationId },
      });
    }
    return response(origin, { error: message, communicationId }, 502);
  }
});
