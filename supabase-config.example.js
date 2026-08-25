/*
 * Configuration publique Supabase. La clé anon est conçue pour être utilisée
 * dans le navigateur : la protection des données est assurée par les règles
 * RLS contenues dans supabase/schema.sql. Ne placez jamais une service_role ici.
 */
window.AB_SUPABASE_CONFIG = {
  url: '',
  anonKey: '',
  // Optionnel : URL de la fonction Edge qui envoie la notification interne.
  // L'enregistrement de la demande ne dépend jamais de cette notification.
  notificationFunctionUrl: ''
};
