(() => {
  'use strict';
  const actions = document.querySelector('.landing-nav-actions');
  const client = window.supabaseClient;
  if (!actions || !client?.auth) return;

  function renderSignedIn(session) {
    const heroActions = document.querySelector('.landing-hero-actions');
    const closingAction = document.querySelector('.landing-cta-button');
    if (session) {
      actions.innerHTML = '<a class="nav-signup" href="/dashboard.html">Dashboard <span aria-hidden="true">→</span></a>';
      if (heroActions) heroActions.innerHTML = '<a class="landing-primary" href="/dashboard.html">Open your dashboard <span aria-hidden="true">→</span></a>';
      if (closingAction) {
        closingAction.href = '/dashboard.html';
        closingAction.innerHTML = 'Open your dashboard <span>→</span>';
      }
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