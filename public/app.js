(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const notice = $('authNotice');
  const supabase = window.supabaseClient || null;

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
    const signup = mode === 'signup';
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

  $('signInTab')?.addEventListener('click', () => setAuthMode('signin'));
  $('signUpTab')?.addEventListener('click', () => setAuthMode('signup'));

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
      window.location.assign('/dashboard.html');
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
      });
      if (error) throw error;
      if (data?.session) {
        window.location.assign('/dashboard.html');
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

  $('demoButton')?.addEventListener('click', () => {
    clearNotice();
    window.location.assign('/dashboard.html?mode=demo');
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login.html?mode=recovery'
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

  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'signup') setAuthMode('signup');
  if (params.get('mode') === 'recovery') {
    showNotice('Password recovery link opened. Password update will be available after the secure recovery screen is completed.', 'success');
  }
  if (!supabase?.auth) {
    console.error('Healthcare OS: Supabase client unavailable. Check the Supabase CDN and configuration scripts.');
  }
})();
