# Configurateur A&B Technologies

Le parcours public `configurateur.html` envoie les demandes à `/api/configurator/submit` sur Cloudflare Pages. La fonction enregistre les réponses dans la base D1 `ab-audit-express` et prépare les notifications administrateur et client via Brevo.

Le portail commercial `portal-ab-gestion-k9m4x.html` utilise Supabase pour ses dossiers historiques, rendez-vous, devis et communications. Il ne lit pas les demandes du configurateur enregistrées dans D1. Tant qu'une intégration vérifiée n'est pas en place, ces demandes ne sont pas gérables depuis ce CRM. `admin.html` est une ancienne page désactivée.

Le formulaire `definir-mot-de-passe.html` dirige vers le portail commercial après une activation réussie. L'accès administrateur nécessite un compte Supabase autorisé dans `app_admins`; ne placez jamais de clé `service_role` dans le navigateur ou le dépôt.

## Vérifications locales

- `npm run check` et `npm run test:audit` valident la syntaxe et les contrôles unitaires disponibles.
- `node node_modules/wrangler/bin/wrangler.js pages dev . --port 8788` démarre Cloudflare Pages avec D1 local.
- `node node_modules/wrangler/bin/wrangler.js d1 execute ab-audit-express --local --file cloudflare/schema.sql` initialise uniquement D1 local.

Les scripts `scripts/test-crm-e2e.mjs` et `scripts/test-notification-live.mjs` créent des dossiers et envoient des messages réels. Ne les lancez que dans un environnement de test autorisé et isolé.