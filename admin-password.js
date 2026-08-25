(() => {
  'use strict';
  const config = window.AB_SUPABASE_CONFIG;
  if (!config || !window.supabase) return;
  const client = window.supabase.createClient(config.url, config.anonKey);
  const hash = window.location.hash;
  const isActivation = /type=(invite|recovery|signup)/.test(hash);

  function showPasswordSetup() {
    if (document.querySelector('#adminPasswordSetup')) return;
    const overlay = document.createElement('div');
    overlay.id = 'adminPasswordSetup';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:#fafbfc';
    overlay.innerHTML = `<form style="width:min(440px,100%);background:#fff;border:1px solid #d8dee6;border-radius:16px;padding:30px;box-shadow:0 18px 55px #1022410d">
      <h1 style="font:800 28px/1.2 Manrope,sans-serif;margin:0 0 10px">Choisissez votre mot de passe</h1>
      <p style="color:#657184">Il protégera l’administration A&amp;B Technologies.</p>
      <label style="display:block;font-weight:700;margin:20px 0 6px">Nouveau mot de passe</label>
      <input id="newAdminPassword" type="password" minlength="10" autocomplete="new-password" required>
      <label style="display:block;font-weight:700;margin:20px 0 6px">Confirmer le mot de passe</label>
      <input id="confirmAdminPassword" type="password" minlength="10" autocomplete="new-password" required>
      <button type="submit" style="width:100%;margin-top:18px">Activer mon accès administrateur</button>
      <p id="adminPasswordMessage" style="min-height:24px;color:#b42318"></p>
    </form>`;
    document.body.appendChild(overlay);
    overlay.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = overlay.querySelector('#newAdminPassword').value;
      const confirmation = overlay.querySelector('#confirmAdminPassword').value;
      const message = overlay.querySelector('#adminPasswordMessage');
      if (password !== confirmation) {
        message.textContent = 'Les deux mots de passe ne correspondent pas.';
        return;
      }
      const button = overlay.querySelector('button');
      button.disabled = true;
      button.textContent = 'Activation…';
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        message.textContent = error.message;
        button.disabled = false;
        button.textContent = 'Activer mon accès administrateur';
        return;
      }
      history.replaceState(null, '', 'admin.html');
      overlay.remove();
      location.reload();
    });
  }

  if (isActivation) showPasswordSetup();
  client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY' || (isActivation && event === 'SIGNED_IN')) showPasswordSetup();
  });
})();
