# Configurateur A&B Technologies

Le parcours public `configurateur.html` envoie les demandes à `/api/configurator/submit` sur Cloudflare Pages. La fonction enregistre les réponses dans la base D1 `ab-audit-express`, synchronise la même demande de façon idempotente dans Supabase via `submit_project_request`, puis prépare les notifications administrateur et client via Brevo. Si Supabase est momentanément indisponible, la demande D1 reste confirmée et la réponse indique `crmSync: "pending"`; un nouvel envoi avec le même identifiant reprend la synchronisation sans créer de doublon.

Le portail commercial `portal-ab-gestion-k9m4x.html` utilise Supabase pour ses dossiers, rendez-vous, devis et communications. Les nouvelles demandes du configurateur sont désormais recopiées dans `project_requests` pour apparaître dans ce CRM. `admin.html` est une ancienne page désactivée.

Le formulaire `definir-mot-de-passe.html` dirige vers le portail commercial après une activation réussie. L'accès administrateur nécessite un compte Supabase autorisé dans `app_admins`; ne placez jamais de clé `service_role` dans le navigateur ou le dépôt.

## Vérifications locales

- `npm run check` et `npm run test:audit` valident la syntaxe et les contrôles unitaires disponibles.
- `node node_modules/wrangler/bin/wrangler.js pages dev . --port 8788` démarre Cloudflare Pages avec D1 local.
- `node node_modules/wrangler/bin/wrangler.js d1 execute ab-audit-express --local --file cloudflare/schema.sql` initialise uniquement D1 local.

Les scripts `scripts/test-crm-e2e.mjs` et `scripts/test-notification-live.mjs` créent des dossiers et envoient des messages réels. Ne les lancez que dans un environnement de test autorisé et isolé.
