# Configurateur A&B Technologies

Le site statique contient désormais un configurateur public (`configurateur.html`) et une administration protégée (`admin.html`). Les demandes ne sont confirmées qu’après l’enregistrement réel dans Supabase.

## Mise en service Supabase

1. Créez un projet Supabase.
2. Dans **SQL Editor**, exécutez intégralement [`supabase/schema.sql`](supabase/schema.sql).
3. Dans **Authentication > Users**, créez l’utilisateur administrateur avec son email et son mot de passe.
4. Copiez son UUID puis exécutez la dernière commande indiquée dans `schema.sql` pour l’ajouter à `app_admins`.
5. Dans `supabase-config.js`, renseignez l’URL du projet et sa clé **anon** (jamais la clé `service_role`).
6. Dans **Authentication > URL Configuration**, ajoutez `https://bayaya-devi.github.io/A-B-TECHNOLOGIES/` aux URL de redirection autorisées.

## Notification email (optionnelle)

L’enregistrement est autonome : l’absence ou l’échec d’une notification ne supprime jamais une demande. Pour recevoir un email à chaque demande, déployez une Supabase Edge Function (ou un webhook serveur) qui accepte `requestId` et `reference`, vérifie le secret côté serveur, puis appelle votre prestataire d’email. Placez son URL dans `notificationFunctionUrl`.

## Publication GitHub Pages

Validez les fichiers, poussez-les sur la branche publiée par GitHub Pages, puis vérifiez :

* `…/configurateur.html` : parcours, brouillon, erreurs et envoi réel ;
* `…/admin.html` : connexion admin, liste, détail, statut, notes et documents ;
* aucun mot de passe, clé API privée ou clé `service_role` n’est ajouté au dépôt.
