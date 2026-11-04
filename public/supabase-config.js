window.HEALTHCARE_SUPABASE = {
  url: 'https://kkmuqehbjhanqckcjqzg.supabase.co',
  publishableKey: 'sb_publishable__jVrv1azwHk_ZLyeVD2ZLQ_hfEKqg8u'
};
window.supabaseClient = window.supabase.createClient(
  window.HEALTHCARE_SUPABASE.url,
  window.HEALTHCARE_SUPABASE.publishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
