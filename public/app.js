const $ = id => document.getElementById(id);
const supabase = window.supabaseClient;

function showNotice(message, kind = 'error') {
  const notice = $('authNotice');
  if (!notice) return;
  notice.textContent = message;
  notice.className = 'notice ' + (kind === 'success' ? 'notice-success' : 'notice-error');
  notice.hidden = false;
}
function clearNotice() {
  if ($('authNotice')) {
    $('authNotice').hidden = true;
    $('authNotice').textContent = '';
  }
}
function setAuthMode(mode) {
  const signup = mode === 'signup';
  $('signInForm').hidden = signup;
  $('signUpForm').hidden = !signup;
  $('signInTab').classList.toggle('active', !signup);
  $('signUpTab').classList.toggle('active', signup);
  $('signInTab').setAttribute('aria-selected', String(!signup));
  $('signUpTab').setAttribute('aria-selected', String(signup));
  $('authTitle').textContent = signup ? 'Care starts here' : 'Welcome back';
  $('authSubtitle').textContent = signup
    ? 'Create your account and bring your care into one place.'
    : 'Sign in to pick up where your family left off.';
  clearNotice();
}
function setBusy(form, busy, label) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = busy;
  button.querySelector('span').textContent = label;
}
$('signInTab').addEventListener('click', () => setAuthMode('signin'));
$('signUpTab').addEventListener('click', () => setAuthMode('signup'));
document.querySelectorAll('.password-toggle').forEach(button => {
  button.addEventListener('click', () => {
    const input = $(button.dataset.target);
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    button.textContent = reveal ? 'Hide' : 'Show';
    button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
  });
});

$('signInForm').addEventListener('submit', async event => {
  event.preventDefault();
  clearNotice();
  const form = event.currentTarget;
  setBusy(form, true, 'Signing you in…');
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: $('loginEmail').value.trim(),
      password: $('loginPassword').value
    });
    if (error) throw error;
    window.location.assign('/dashboard.html');
  } catch (error) {
    showNotice(error.message || 'Unable to sign in. Please try again.');
  } finally {
    setBusy(form, false, 'Sign in to your space');
  }
});

$('signUpForm').addEventListener('submit', async event => {
  event.preventDefault();
  clearNotice();
  if (!$('agreeTerms').checked) {
    showNotice('Please confirm the demonstration terms to continue.');
    return;
  }
  const form = event.currentTarget;
  setBusy(form, true, 'Creating your account…');
  try {
    const { data, error } = await supabase.auth.signUp({
      email: $('signupEmail').value.trim(),
      password: $('signupPassword').value,
      options: { data: { full_name: $('signupName').value.trim() } }
    });
    if (error) throw error;
    if (data.session) {
      window.location.assign('/dashboard.html');
    } else {
      setAuthMode('signin');
      $('loginEmail').value = $('signupEmail').value.trim();
      showNotice('Account created. Check your email to confirm your address, then sign in.', 'success');
    }
  } catch (error) {
    showNotice(error.message || 'Unable to create your account. Please try again.');
  } finally {
    setBusy(form, false, 'Create my account');
  }
});

$('demoButton').addEventListener('click', () => {
  clearNotice();
  window.location.assign('/dashboard.html?mode=demo');
});

$('forgotButton').addEventListener('click', async () => {
  clearNotice();
  const email = $('loginEmail').value.trim();
  if (!email) {
    showNotice('Enter your email address first, then select Forgot password.');
    $('loginEmail').focus();
    return;
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login.html?mode=recovery'
    });
    if (error) throw error;
    showNotice('If an account exists for this address, a password reset email has been sent.', 'success');
  } catch (error) {
    showNotice(error.message || 'Unable to request a password reset.');
  }
});

$('termsLink').addEventListener('click', event => {
  event.preventDefault();
  showNotice('Prototype terms: use sample information only. This app is not intended for real patient records.', 'success');
});
$('privacyLink').addEventListener('click', event => {
  event.preventDefault();
  showNotice('Privacy notice: this prototype uses sample records. Do not enter real or sensitive health information.', 'success');
});

const params = new URLSearchParams(window.location.search);
if (params.get('mode') === 'signup') setAuthMode('signup');
if (params.get('mode') === 'recovery') {
  showNotice('Password recovery link opened. Password update will be available after the secure recovery screen is completed.', 'success');
}
