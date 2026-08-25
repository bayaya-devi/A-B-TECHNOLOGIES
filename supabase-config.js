/* Configuration publique A&B Technologies. Aucune clé privilégiée ici. */
window.AB_SUPABASE_CONFIG = {
  url: 'https://elusxpsvgimtavlypjlp.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdXN4cHN2Z2ltdGF2bHlwamxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NjM1ODAsImV4cCI6MjEwMzIzOTU4MH0.gXQEmUf4DEjwZPwlEgNglYrgANr341fLkcmAdH9mspM',
  notificationFunctionUrl: 'https://elusxpsvgimtavlypjlp.supabase.co/functions/v1/notify-new-request'
};

// Rend la création idempotente même après une coupure réseau, et authentifie
// les appels à la fonction Edge avec la clé publique Supabase.
(() => {
  const nativeFetch = window.fetch.bind(window);
  const config = window.AB_SUPABASE_CONFIG;
  const submissionKeyName = 'ab-project-submission-id';
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const options = { ...init };
    if (url.includes('/rest/v1/rpc/submit_project_request') && typeof options.body === 'string') {
      try {
        const body = JSON.parse(options.body);
        if (body?.payload && !body.payload.submission_id) {
          let submissionId = localStorage.getItem(submissionKeyName);
          if (!submissionId) {
            submissionId = crypto.randomUUID();
            localStorage.setItem(submissionKeyName, submissionId);
          }
          body.payload.submission_id = submissionId;
          options.body = JSON.stringify(body);
        }
      } catch { /* La bibliothèque gérera une éventuelle erreur de corps. */ }
    }
    if (url === config.notificationFunctionUrl) {
      const headers = new Headers(options.headers || {});
      headers.set('apikey', config.anonKey);
      headers.set('Authorization', `Bearer ${config.anonKey}`);
      options.headers = headers;
      localStorage.removeItem(submissionKeyName);
    }
    return nativeFetch(input, options);
  };
})();
