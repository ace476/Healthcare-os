'use strict';
const $ = id => document.getElementById(id);
const pageName = document.body.dataset.page || '';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const client = window.supabaseClient;

function loginRedirectUrl() {
  const next = window.location.pathname + window.location.search + window.location.hash;
  return '/login.html?next=' + encodeURIComponent(next);
}

async function api(url, options = {}) {
  if (!client?.auth) throw new Error('Secure sign-in is unavailable. Refresh the page and try again.');
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) {
    window.location.replace(loginRedirectUrl());
    throw new Error('Please sign in to continue.');
  }
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: { ...(options.headers || {}), Authorization: 'Bearer ' + session.access_token,
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to complete this request.');
  return body;
}

function renderList(id, items, render, emptyText = 'No records to show.') {
  const host = $(id);
  if (!host) return;
  host.innerHTML = items.length ? items.map(render).join('') : '<p class="empty-state">' + esc(emptyText) + '</p>';
}
function familyCard(member) {
  const initials = String(member.name || 'U').split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
  return '<div class="record-item"><div class="record-avatar family-avatar">' + esc(initials) + '</div><div class="record-body"><strong>' + esc(member.name) + '</strong><span>' + esc(member.role) + (member.age !== '' ? ' · ' + esc(member.age) + ' years' : '') + '</span><small>' + esc((member.conditions || []).join(', ') || 'No notes added') + '</small></div></div>';
}
function appointmentCard(item) {
  const date = new Date(item.date + 'T12:00:00Z');
  const day = Number.isNaN(date.getTime()) ? '--' : String(date.getUTCDate()).padStart(2,'0');
  const month = Number.isNaN(date.getTime()) ? '---' : date.toLocaleDateString('en',{month:'short',timeZone:'UTC'}).toUpperCase();
  return '<div class="record-item"><div class="date-chip"><strong>' + day + '</strong><span>' + month + '</span></div><div class="record-body"><strong>' + esc(item.patient) + '</strong><span>' + esc(item.type) + ' · ' + esc(item.time) + '</span><small>' + esc(item.doctor) + ' · ' + esc(item.date) + '</small></div><span class="med-status">' + esc(item.status || 'scheduled') + '</span></div>';
}
function medicationCard(item) {
  return '<div class="record-item"><div class="record-avatar med-avatar">✚</div><div class="record-body"><strong>' + esc(item.name) + '</strong><span>' + esc(item.member) + '</span><small>' + esc(item.dose) + ' · ' + esc(item.schedule) + '</small></div><span class="med-status">' + esc(item.status || 'active') + '</span></div>';
}
function doctorCard(item) {
  return '<div class="record-item"><div class="record-avatar doctor-avatar">♡</div><div class="record-body"><strong>' + esc(item.name) + '</strong><span>' + esc(item.specialty) + '</span><small>' + esc(item.clinic) + ' · ' + esc(item.available) + '</small></div></div>';
}
function genericCard(item) {
  const title = item.title || item.metric_name || item.blood_group || item.kind || 'Record';
  const detail = item.body || item.value_text || [item.value_numeric, item.unit].filter(Boolean).join(' ') || item.allergies || item.conditions || '';
  const date = item.created_at || item.measured_at || item.updated_at || item.document_date || '';
  return '<div class="record-item"><div class="record-avatar">▤</div><div class="record-body"><strong>' + esc(title) + '</strong><span>' + esc(detail) + '</span><small>' + esc(date ? String(date).slice(0,10) : '') + '</small></div></div>';
}
async function loadDashboard() {
  const [family, appointments, medications, doctors] = await Promise.all([
    api('/api/family'), api('/api/appointments'), api('/api/medications'), api('/api/doctors')
  ]);
  if ($('memberCount')) $('memberCount').textContent = family.members.length;
  if ($('appointmentCount')) $('appointmentCount').textContent = appointments.length;
  if ($('medicationCount')) $('medicationCount').textContent = medications.length;
  if ($('doctorCount')) $('doctorCount').textContent = doctors.length;
  if ($('navAppointmentCount')) $('navAppointmentCount').textContent = appointments.length;
  renderList('overviewAppointments', appointments.slice(0,3), appointmentCard);
  renderList('overviewFamily', family.members.slice(0,3), familyCard);
  renderList('overviewMedications', medications.slice(0,3), medicationCard);
  renderList('overviewDoctors', doctors.slice(0,3), doctorCard);
  renderList('familyList', family.members, familyCard, 'Your family workspace is ready. Add your first member below.');
  renderList('appointmentList', appointments, appointmentCard, 'No appointments scheduled yet.');
  renderList('medicationList', medications, medicationCard, 'No medications have been added.');
  renderList('doctorList', doctors, doctorCard, 'No care professionals have been added.');
}
function bindForm(id, endpoint, feedbackId) {
  const form = $(id);
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const feedback = $(feedbackId);
    if (button) button.disabled = true;
    if (feedback) feedback.textContent = 'Saving…';
    try {
      await api(endpoint, { method:'POST', body:JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      if (feedback) feedback.textContent = 'Saved to your private workspace.';
      await loadDashboard();
    } catch (error) {
      if (feedback) feedback.textContent = error.message;
    } finally {
      if (button) button.disabled = false;
    }
  });
}
async function boot() {
  if (!client?.auth) { window.location.replace('/login.html'); return; }
  const { data: { session } } = await client.auth.getSession();
  if (!session) { window.location.replace('/login.html'); return; }
  const me = await api('/api/me');
  const display = me.name || me.email || 'My workspace';
  if ($('profileName')) $('profileName').textContent = display;
  if ($('profileEmail')) $('profileEmail').textContent = me.email || '';
  if ($('profileInitials')) $('profileInitials').textContent = display.slice(0,1).toUpperCase();
  if ($('topInitials')) $('topInitials').textContent = display.slice(0,1).toUpperCase();
  await api('/api/family');

  document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('selected', link.dataset.nav === pageName));
  $('mobileMenu')?.addEventListener('click', () => $('sidebar')?.classList.toggle('sidebar-open'));
  document.querySelector('.signout-button')?.addEventListener('click', async event => {
    event.preventDefault();
    await client.auth.signOut();
    window.location.replace('/login.html');
  });
  client.auth.onAuthStateChange((event, nextSession) => {
    if (event === 'SIGNED_OUT' || !nextSession) window.location.replace('/login.html');
  });
  bindForm('familyForm','/api/family-members','familyFeedback');
  bindForm('appointmentForm','/api/appointments','appointmentFeedback');

  if (pageName === 'workspace') {
    const sectionName = new URLSearchParams(location.search).get('section');
    const config = {
      records: ['Medical records','/api/medical-records','Your private document metadata. Secure file upload and download are not enabled yet.'],
      tracking: ['Health tracking','/api/health-metrics','Health measurements saved in your workspace.'],
      emergency: ['Emergency information','/api/emergency-info','Emergency details saved in your workspace.'],
      notifications: ['Notifications','/api/notifications','Private notifications for your account.']
    }[sectionName];
    const main = document.querySelector('.dashboard-content');
    if (config && main) {
      document.title = config[0] + ' · Healthcare OS';
      main.innerHTML = '<div class="welcome-row"><div><span class="eyebrow">YOUR PRIVATE WORKSPACE</span><h1>' + esc(config[0]) + '</h1><p>' + esc(config[2]) + '</p></div></div><section class="panel"><div id="workspaceRecords" class="record-list"><p class="empty-state">Loading…</p></div></section>';
      try { const rows = await api(config[1]); renderList('workspaceRecords', rows, genericCard); }
      catch (error) { renderList('workspaceRecords', [], genericCard, error.message); }
    }
  } else {
    await loadDashboard();
  }
}
boot().catch(error => {
  console.error('Healthcare OS workspace could not load:', error);
  document.querySelectorAll('.record-list').forEach(host => { host.textContent = error.message; });
});
