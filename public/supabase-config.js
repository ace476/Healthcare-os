(() => {
  'use strict';
  window.HEALTHCARE_SUPABASE = {
    url: 'https://kkmuqehbjhanqckcjqzg.supabase.co',
    publishableKey: 'sb_publishable__jVrv1azwHk_ZLyeVD2ZLQ_hfEKqg8u'
  };
  if (!window.supabase?.createClient) {
    console.error('Healthcare OS: Supabase JS library failed to load.');
    window.supabaseClient = null;
    return;
  }
  // Use localStorage for the default "keep me signed in" experience.
  // When a user opts out, use sessionStorage so the session ends with the tab.
  let rememberSession = true;
  try {
    rememberSession = window.localStorage.getItem('healthcare-os-remember-session') !== 'false';
  } catch (error) {
    console.warn('Healthcare OS: persistent storage preference is unavailable; using session storage.');
    rememberSession = false;
  }
  let authStorage;
  try {
    authStorage = rememberSession ? window.localStorage : window.sessionStorage;
  } catch (error) {
    console.error('Healthcare OS: browser session storage is unavailable.', error);
    window.supabaseClient = null;
    return;
  }
  window.supabaseClient = window.supabase.createClient(
    window.HEALTHCARE_SUPABASE.url,
    window.HEALTHCARE_SUPABASE.publishableKey,
    {
      auth: {
        storage: authStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();
