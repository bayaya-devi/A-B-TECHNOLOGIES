import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cleanEmail, cleanPhone, cleanUrl } from '../functions/_lib/util.js';
import { makePasswordHash } from '../functions/_lib/auth.js';
import { generateAuditSummaryPdf } from '../functions/_lib/pdf.js';

assert.equal(cleanEmail(' Client@Example.com '), 'client@example.com');
assert.equal(cleanPhone('+33 6 12 34 56 78'), '+33 6 12 34 56 78');
assert.throws(() => cleanEmail('adresse-invalide'));
assert.throws(() => cleanUrl('javascript:alert(1)'));
assert.equal(cleanUrl('https://example.com'), 'https://example.com/');

const passwordHash = await makePasswordHash('Test-password-123!');
assert.match(passwordHash, /^pbkdf2-sha256\$210000\$/);

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
