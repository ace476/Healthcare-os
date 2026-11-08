(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const notice = $('authNotice');
  const supabase = window.supabaseClient || null;
  const params = new URLSearchParams(window.location.search);
  const recoveryMode = params.get('mode') === 'recovery';
  const rememberMe = $('rememberMe');
  let recoveryReady = false;
  const signupAvailable = false;

  function safeNextPath() {
    const requested = params.get('next') || '/dashboard.html';
    if (!requested.startsWith('/') || requested.startsWith('//') || requested.includes('\\')) return '/dashboard.html';
    try {
      const target = new URL(requested, window.location.origin);
      if (target.origin !== window.location.origin || target.pathname === '/login.html') return '/dashboard.html';
      return target.pathname + target.search + target.hash;
    } catch (_) {
      return '/dashboard.html';
    }
  }
  function continueAfterAuth() {
    window.location.replace(safeNextPath());
  }

  function showNotice(message, kind = 'error') {
    if (!notice) return;
    notice.textContent = message;
    notice.className = 'notice ' + (kind === 'success' ? 'notice-success' : 'notice-error');
    notice.hidden = false;
  }
  function clearNotice() {
    if (!notice) return;
    notice.hidden = true;
    notice.textContent = '';
  }
  function setAuthMode(mode) {
    const signup = mode === 'signup' && signupAvailable;
    const signInForm = $('signInForm');
    const signUpForm = $('signUpForm');
    if (!signInForm || !signUpForm) return;
    signInForm.hidden = signup;
    signUpForm.hidden = !signup;
    $('signInTab')?.classList.toggle('active', !signup);
    $('signUpTab')?.classList.toggle('active', signup);
    $('signInTab')?.setAttribute('aria-selected', String(!signup));
    $('signUpTab')?.setAttribute('aria-selected', String(signup));
    if ($('authTitle')) $('authTitle').textContent = signup ? 'Care starts here' : 'Welcome back';
    if ($('authSubtitle')) $('authSubtitle').textContent = signup
      ? 'Create your account and bring your care into one place.'
      : 'Sign in to pick up where your family left off.';
    clearNotice();
  }
  function setBusy(form, busy, label) {
    const button = form?.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = busy;
    const text = button.querySelector('span');
    if (text) text.textContent = label;
  }
  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  function authReady() {
    if (supabase?.auth) return true;
    showNotice('The secure sign-up service did not load. Please refresh this page. If it continues, try another network or browser.');
    return false;
  }

  function showRecoveryForm(ready) {
    recoveryReady = ready;
    const recoveryForm = $('recoveryForm');
    if (!recoveryForm) return;
    $('authTabs')?.setAttribute('hidden', '');
    $('signInForm')?.setAttribute('hidden', '');
    $('signUpForm')?.setAttribute('hidden', '');
    recoveryForm.hidden = false;
    $('authTitle').textContent = 'Choose a new password';
    $('authSubtitle').textContent = 'Create a new password to secure your account.';
    $('recoveryPassword').disabled = !ready;
    $('recoveryConfirm').disabled = !ready;
    recoveryForm.querySelector('button[type="submit"]').disabled = !ready;
    if (!ready) showNotice('Open the password reset link from your email in this browser. If the link has expired, request a new one.', 'success');
    else clearNotice();
    document.querySelector('.divider')?.setAttribute('hidden', '');
    $('demoButton')?.setAttribute('hidden', '');
    document.querySelector('.auth-legal')?.setAttribute('hidden', '');
  }

  $('signInTab')?.addEventListener('click', () => setAuthMode('signin'));
  $('signUpTab')?.addEventListener('click', () => setAuthMode('signup'));

  if (rememberMe) {
    let shouldRemember = true;
    try {
      shouldRemember = window.localStorage.getItem('healthcare-os-remember-session') !== 'false';
    } catch (_) {
      shouldRemember = false;
    }
    rememberMe.checked = shouldRemember;
    rememberMe.addEventListener('change', () => {
      try {
        window.localStorage.setItem('healthcare-os-remember-session', String(rememberMe.checked));
        // Supabase chooses its storage adapter when the client is created.
        // Reload so the next client uses the selected browser storage safely.
        window.location.reload();
      } catch (error) {
        rememberMe.checked = true;
        showNotice('This browser does not allow changing the sign-in storage preference.');
      }
    });
  }

  document.querySelectorAll('.password-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const input = $(button.dataset.target);
      if (!input) return;
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.textContent = reveal ? 'Hide' : 'Show';
      button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
    });
  });

  $('signInForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    clearNotice();
    const email = $('loginEmail')?.value.trim() || '';
    const password = $('loginPassword')?.value || '';
    if (!validEmail(email)) return showNotice('Enter a valid email address.');
    if (!password) return showNotice('Enter your password.');
    if (!authReady()) return;
    const form = event.currentTarget;
    setBusy(form, true, 'Signing you in…');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      continueAfterAuth();
    } catch (error) {
      console.error('Healthcare OS sign-in failed:', error);
      showNotice(error.message || 'Unable to sign in. Please try again.');
    } finally {
      setBusy(form, false, 'Sign in to your space');
    }
  });

  $('signUpForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    clearNotice();
    const name = $('signupName')?.value.trim() || '';
    const email = $('signupEmail')?.value.trim() || '';
    const password = $('signupPassword')?.value || '';
    if (name.length < 2) return showNotice('Enter your full name (at least 2 characters).');
    if (!validEmail(email)) return showNotice('Enter a valid email address.');
    if (password.length < 8) return showNotice('Your password must contain at least 8 characters.');
    if (!$('agreeTerms')?.checked) return showNotice('Please tick the box to confirm the demonstration terms.');
    if (!authReady()) return;
    const form = event.currentTarget;
    setBusy(form, true, 'Creating your account…');
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, email, password })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to create your account. Please try again.');
      if (result?.session) {
        const { error: sessionError } = await supabase.auth.setSession(result.session);
        if (sessionError) throw sessionError;
        continueAfterAuth();
        return;
      }
      setAuthMode('signin');
      if ($('loginEmail')) $('loginEmail').value = email;
      showNotice('Your account request was accepted. Check your email for the confirmation link, then sign in.', 'success');
    } catch (error) {
      console.error('Healthcare OS account creation failed:', error);
      const message = error?.message || 'Unable to create your account. Please try again.';
      showNotice(message);
    } finally {
      setBusy(form, false, 'Create my account');
    }
  });

  $('recoveryForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    clearNotice();
    if (!authReady()) return;
    if (!recoveryReady) return showNotice('Open a valid password reset link from your email first.');
    const password = $('recoveryPassword')?.value || '';
    const confirmation = $('recoveryConfirm')?.value || '';
    if (password.length < 12 || password.length > 128) return showNotice('Your new password must contain between 12 and 128 characters.');
    if (password !== confirmation) return showNotice('The passwords do not match.');
    const form = event.currentTarget;
    setBusy(form, true, 'Updating password…');
    try {
      const { data: sessionData } = await supabase.auth.getSession();\n      const accessToken = sessionData?.session?.access_token;\n      if (!accessToken) throw new Error('Your password reset session has expired. Request a new reset link.');\n      const screeningResponse = await fetch('/api/auth/password-check', {\n        method: 'POST',\n        credentials: 'same-origin',\n        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },\n        body: JSON.stringify({ password })\n      });\n      const screening = await screeningResponse.json().catch(() => ({}));\n      if (!screeningResponse.ok) throw new Error(screening.error || 'Unable to screen this password safely.');\n      if (screening.compromised) throw new Error('This password appears in known data breaches. Choose a different password.');\n      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      window.location.replace('/login.html?password=updated');
    } catch (error) {
      console.error('Healthcare OS password update failed:', error);
      showNotice(error.message || 'Unable to update your password. Request a new reset link and try again.');
    } finally {
      setBusy(form, false, 'Update password');
    }
  });

  $('demoButton')?.addEventListener('click', () => {
    window.location.assign('/demo.html');
  });

  $('forgotButton')?.addEventListener('click', async () => {
    clearNotice();
    const email = $('loginEmail')?.value.trim() || '';
    if (!validEmail(email)) {
      showNotice('Enter a valid email address first, then select Forgot password.');
      $('loginEmail')?.focus();
      return;
    }
    if (!authReady()) return;
    try {
      // Always send recovery links to the production app, even when the request
      // was started from localhost during local development.
      const recoveryRedirect = 'https://healthcare-os.vercel.app/login.html?mode=recovery';
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryRedirect
      });
      if (error) throw error;
      showNotice('If an account exists for this address, a password reset email has been sent.', 'success');
    } catch (error) {
      console.error('Healthcare OS password reset request failed:', error);
      showNotice(error.message || 'Unable to request a password reset.');
    }
  });

  $('termsLink')?.addEventListener('click', event => {
    event.preventDefault();
    showNotice('Prototype terms: use sample information only. This app is not intended for real patient records.', 'success');
  });
  $('privacyLink')?.addEventListener('click', event => {
    event.preventDefault();
    showNotice('Privacy notice: this prototype uses sample records. Do not enter real or sensitive health information.', 'success');
  });

  setAuthMode(params.get('mode') === 'signup' ? 'signup' : 'signin');
  if (params.get('mode') === 'signup' && !signupAvailable) showNotice('New account registration is paused for this public demo. Explore the sample workspace or sign in to an existing account.', 'success');
  if (recoveryMode) showRecoveryForm(false);
  if (params.get('password') === 'updated') showNotice('Your password has been updated. Sign in with your new password.', 'success');

  // Keep signed-in users out of the login screen. Recovery links stay on this page.
  if (supabase?.auth) {
    supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY' && recoveryMode) showRecoveryForm(true);
      else if (event === 'SIGNED_IN' && !recoveryMode) continueAfterAuth();
    });
    if (!recoveryMode) {
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        if (data?.session) continueAfterAuth();
      }).catch(error => {
        console.error('Healthcare OS could not restore the existing session:', error);
      });
    }
  }
  if (!supabase?.auth) {
    console.error('Healthcare OS: Supabase client unavailable. Check the Supabase CDN and configuration scripts.');
  }
})();
