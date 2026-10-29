const $ = (id) => document.getElementById(id);
let currentUser = null;

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
function showNotice(message, kind = 'error') {
  const notice = $('authNotice');
  notice.textContent = message;
  notice.className = 'notice ' + (kind === 'success' ? 'notice-success' : 'notice-error');
  notice.hidden = false;
}
function clearNotice() {
  $('authNotice').hidden = true;
  $('authNotice').textContent = '';
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
$('signInTab').addEventListener('click', () => setAuthMode('signin'));
$('signUpTab').addEventListener('click', () => setAuthMode('signup'));

document.querySelectorAll('.password-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const input = $(button.dataset.target);
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    button.textContent = reveal ? 'Hide' : 'Show';
    button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
  });
});

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function enterWorkspace(user) {
  currentUser = user;
  $('authScreen').hidden = true;
  $('appShell').hidden = false;
  const name = user.name || 'there';
  const first = name.trim().split(/\s+/)[0];
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  $('profileName').textContent = name;
  $('profileEmail').textContent = user.email;
  $('profileInitials').textContent = initials;
  $('topInitials').textContent = initials;
  $('welcomeTitle').innerHTML = `Welcome back, ${escapeHTML(first)} <span>✦</span>`;
  const hour = new Date().getHours();
  $('todayLabel').textContent = hour < 12 ? 'YOUR FAMILY AT A GLANCE · GOOD MORNING' : hour < 17 ? 'YOUR FAMILY AT A GLANCE · GOOD AFTERNOON' : 'YOUR FAMILY AT A GLANCE · GOOD EVENING';
  document.querySelector('.privacy-pill').innerHTML = user.demo
    ? '<span>●</span> Demo workspace'
    : '<span>●</span> Prototype account';
  loadData().catch((error) => showDashboardError(error.message));
}
function showSignIn() {
  currentUser = null;
  $('appShell').hidden = true;
  $('authScreen').hidden = false;
  $('signInForm').reset();
  $('signUpForm').reset();
  setAuthMode('signin');
}
function showDashboardError(message) {
  ['familyMembers', 'appointments', 'medications', 'doctors'].forEach((id) => {
    $(id).innerHTML = `<p class="empty-state">${escapeHTML(message)}</p>`;
  });
}
$('signInForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearNotice();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.querySelector('span').textContent = 'Signing you in…';
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: $('loginEmail').value,
        password: $('loginPassword').value
      })
    });
    enterWorkspace(data.user);
  } catch (error) {
    showNotice(error.message);
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = 'Sign in to your space';
  }
});
$('signUpForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearNotice();
  if (!$('agreeTerms').checked) {
    showNotice('Please confirm the demonstration terms to continue.');
    return;
  }
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.querySelector('span').textContent = 'Creating your account…';
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: $('signupName').value,
        email: $('signupEmail').value,
        password: $('signupPassword').value
      })
    });
    enterWorkspace(data.user);
  } catch (error) {
    showNotice(error.message);
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = 'Create my account';
  }
});
$('demoButton').addEventListener('click', () => {
  clearNotice();
  // The public demo should work without credentials or an auth service.
  // The dashboard reads its sample records from the existing demo API routes.
  enterWorkspace({
    name: 'Asha Patel',
    email: 'admin@demo.com',
    demo: true
  });
});
$('forgotButton').addEventListener('click', () => {
  showNotice('Password reset email is not configured in this prototype. Please contact the app administrator.', 'success');
});
$('termsLink').addEventListener('click', (event) => {
  event.preventDefault();
  showNotice('Prototype terms: use sample information only. This app is not intended for real patient records.', 'success');
});
$('privacyLink').addEventListener('click', (event) => {
  event.preventDefault();
  showNotice('Privacy notice: this prototype uses temporary in-memory demo records. Do not enter real or sensitive health information.', 'success');
});
$('signOutButton').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); } catch (error) { /* Return to sign-in even if the network is unavailable. */ }
  showSignIn();
});

async function loadData() {
  const [family, appointments, medications, doctors] = await Promise.all([
    api('/api/family'), api('/api/appointments'), api('/api/medications'), api('/api/doctors')
  ]);
  $('memberCount').textContent = family.members.length;
  $('appointmentCount').textContent = appointments.length;
  $('medicationCount').textContent = medications.length;
  $('doctorCount').textContent = doctors.length;
  $('navAppointmentCount').textContent = appointments.length;

  const renderList = (elementId, items, formatter, emptyText) => {
    const element = $(elementId);
    element.innerHTML = items.length
      ? items.map((item) => `<div class="record-item">${formatter(item)}</div>`).join('')
      : `<p class="empty-state">${escapeHTML(emptyText || 'No records yet.')}</p>`;
  };
  renderList('familyMembers', family.members, (member) => {
    const initials = member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    return `<div class="record-avatar family-avatar">${escapeHTML(initials)}</div><div class="record-body"><strong>${escapeHTML(member.name)}</strong><span>${escapeHTML(member.role)} · ${escapeHTML(member.age)} years</span><small>${escapeHTML(member.conditions.join(', ') || 'No conditions listed')}</small></div><span class="record-dot">●</span>`;
  });
  renderList('appointments', appointments, (item) => {
    const date = new Date(item.date + 'T12:00:00');
    const day = Number.isNaN(date.getTime()) ? '--' : String(date.getDate()).padStart(2, '0');
    const month = Number.isNaN(date.getTime()) ? '---' : date.toLocaleDateString('en', { month: 'short' }).toUpperCase();
    return `<div class="date-chip"><strong>${day}</strong><span>${month}</span></div><div class="record-body"><strong>${escapeHTML(item.patient)}</strong><span>${escapeHTML(item.type)} · ${escapeHTML(item.time)}</span><small>${escapeHTML(item.doctor)} · ${escapeHTML(item.date)}</small></div><span class="mini-arrow">↗</span>`;
  });
  renderList('medications', medications, (item) => `<div class="record-avatar med-avatar">✚</div><div class="record-body"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.member)}</span><small>${escapeHTML(item.dose)} · ${escapeHTML(item.schedule)}</small></div><span class="med-status">Listed</span>`);
  renderList('doctors', doctors, (item) => {
    const initials = item.name.replace('Dr. ', '').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    return `<div class="record-avatar doctor-avatar">${escapeHTML(initials)}</div><div class="record-body"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.specialty)}</span><small>${escapeHTML(item.clinic)} · ${escapeHTML(item.available)}</small></div><span class="doctor-online">●</span>`;
  });
}

function openForm(formId) {
  $('familyFormPanel').hidden = formId !== 'familyForm';
  $('appointmentFormPanel').hidden = formId !== 'appointmentForm';
  if (formId === 'appointmentForm') $('appointmentFormPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (formId === 'familyForm') $('familyFormPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
$('newAppointmentButton').addEventListener('click', () => openForm('appointmentForm'));
$('addMemberButton').addEventListener('click', () => openForm('familyForm'));
$('exploreFamilyButton').addEventListener('click', () => navigateSection('family'));
document.querySelectorAll('[data-close-form]').forEach((button) => button.addEventListener('click', () => {
  $('familyFormPanel').hidden = true;
  $('appointmentFormPanel').hidden = true;
}));
$('familyForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    await api('/api/family-members', { method: 'POST', body: JSON.stringify(payload) });
    event.currentTarget.reset();
    $('familyFormPanel').hidden = true;
    await loadData();
  } catch (error) { window.alert(error.message); }
  finally { button.disabled = false; }
});
$('appointmentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    await api('/api/appointments', { method: 'POST', body: JSON.stringify(payload) });
    event.currentTarget.reset();
    $('appointmentFormPanel').hidden = true;
    await loadData();
  } catch (error) { window.alert(error.message); }
  finally { button.disabled = false; }
});

function navigateSection(section) {
  const labels = { overview: 'Overview', family: 'Family members', appointments: 'Appointments', medications: 'Medications', doctors: 'Care team' };
  $('breadcrumbCurrent').textContent = labels[section] || 'Overview';
  document.querySelectorAll('.nav-link').forEach((button) => button.classList.toggle('selected', button.dataset.section === section));
  const panels = {
    family: ['familyPanel'], appointments: ['appointmentsPanel'],
    medications: ['medicationsPanel'], doctors: ['doctorsPanel']
  };
  const selected = panels[section];
  ['appointmentsPanel', 'familyPanel', 'medicationsPanel', 'doctorsPanel'].forEach((id) => {
    $(id).hidden = Boolean(selected && !selected.includes(id));
  });
  if (section === 'overview') {
    ['appointmentsPanel', 'familyPanel', 'medicationsPanel', 'doctorsPanel'].forEach((id) => $(id).hidden = false);
  }
  $('familyFormPanel').hidden = true;
  $('appointmentFormPanel').hidden = true;
  $('sidebar').classList.remove('sidebar-open');
}
document.querySelectorAll('.nav-link').forEach((button) => button.addEventListener('click', () => navigateSection(button.dataset.section)));
document.querySelectorAll('[data-section-link]').forEach((button) => button.addEventListener('click', () => navigateSection(button.dataset.sectionLink)));
$('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('sidebar-open'));

(async function init() {
  if (new URLSearchParams(window.location.search).get('mode') === 'signup') setAuthMode('signup');
  try {
    const data = await api('/api/auth/me');
    enterWorkspace(data.user);
  } catch {
    $('authScreen').hidden = false;
    $('appShell').hidden = true;
  }
})();
