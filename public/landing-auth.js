(() => {
  'use strict';
  const actions = document.querySelector('.landing-nav-actions');
  const client = window.supabaseClient;
  if (!actions || !client?.auth) return;

  function renderSignedIn(session) {
    if (session) {
      actions.innerHTML = '<a class="nav-signup" href="/dashboard.html">Dashboard <span aria-hidden="true">→</span></a>';
      return;
    }
    actions.innerHTML = '<a class="nav-login" href="/login.html">Log in</a><a class="nav-signup" href="/login.html?mode=signup">Get started <span aria-hidden="true">→</span></a>';
  }

  client.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    renderSignedIn(data?.session || null);
  }).catch(error => {
    console.error('Healthcare OS landing-page session check failed:', error);
  });
  client.auth.onAuthStateChange((_event, session) => renderSignedIn(session));
})();