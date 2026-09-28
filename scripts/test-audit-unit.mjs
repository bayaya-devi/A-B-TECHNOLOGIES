import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cleanEmail, cleanPhone, cleanUrl } from '../functions/_lib/util.js';
import { requireAdmin } from '../functions/_lib/auth.js';
import { readJson } from '../functions/_lib/http.js';
import { generateAuditSummaryPdf } from '../functions/_lib/pdf.js';

assert.equal(cleanEmail(' Client@Example.com '), 'client@example.com');
assert.equal(cleanPhone('+33 6 12 34 56 78'), '+33 6 12 34 56 78');
assert.throws(() => cleanEmail('adresse-invalide'));
assert.throws(() => cleanUrl('javascript:alert(1)'));
assert.equal(cleanUrl('https://example.com'), 'https://example.com/');

const request = new Request('https://example.com/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) });
assert.deepEqual(await readJson(request, 32), { ok: true });
await assert.rejects(() => readJson(new Request('https://example.com/api', { method: 'POST', body: 'x'.repeat(40) }), 16), /trop volumineuse/i);

const originalFetch = globalThis.fetch;
let membershipRows = [{ user_id: 'admin-id' }];
globalThis.fetch = async url => String(url).includes('/auth/v1/user')
  ? Response.json({ id: 'admin-id', email: 'admin@example.com' })
  : Response.json(membershipRows);
const adminContext = { request: new Request('https://example.com/api', { headers: { authorization: 'Bearer valid-token' } }), env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'public-anon-key' }, data: {} };
assert.deepEqual(await requireAdmin(adminContext), { id: 'admin-id', email: 'admin@example.com' });
membershipRows = [];
assert.deepEqual(await requireAdmin({ ...adminContext, data: {} }), { denied: true });
globalThis.fetch = originalFetch;

const pdf = await generateAuditSummaryPdf({
  reference: 'AUD-2026-000001', status: 'NEW', submitted_at: new Date().toISOString(),
  first_name: 'Test', last_name: 'Client', email: 'test@example.com', phone: '+33 6 12 34 56 78',
  company_name: 'Entreprise Test', activity: 'Conseil', city: 'Lagos', company_description: 'Description complète',
  digital_presence: JSON.stringify({ website: { present: true, url: 'https://example.com' } }),
  main_objective: 'ameliorer_visibilite', objective_details: 'Objectif détaillé',
  main_problem: 'peu_visible', problem_details: 'Problème détaillé', additional_information: 'Commentaire final',
});
assert.equal(new TextDecoder().decode(pdf.subarray(0, 5)), '%PDF-');
assert.ok(pdf.byteLength > 1500);

const html = await readFile(new URL('../demander-audit.html', import.meta.url), 'utf8');
for (const id of ['auditStart', 'auditWizard', 'stepCount', 'progressBar', 'previous', 'next', 'cancelAudit', 'confirmation']) {
  assert.match(html, new RegExp(`id=["']${id}["']`));
}

console.log('Audit Express unit checks: OK');
