async function loadData() {
  const [familyRes, appointmentsRes, medicationsRes, doctorsRes] = await Promise.all([
    fetch('/api/family'),
    fetch('/api/appointments'),
    fetch('/api/medications'),
    fetch('/api/doctors')
  ]);

  const family = await familyRes.json();
  const appointments = await appointmentsRes.json();
  const medications = await medicationsRes.json();
  const doctors = await doctorsRes.json();

  document.getElementById('familyCode').textContent = family.familyCode;
  document.getElementById('memberCount').textContent = family.members.length;
  document.getElementById('appointmentCount').textContent = appointments.length;
  document.getElementById('medicationCount').textContent = medications.length;
  document.getElementById('doctorCount').textContent = doctors.length;

  const renderList = (elId, items, formatter) => {
    const el = document.getElementById(elId);
    el.innerHTML = items.length
      ? items.map((item) => `<div class="list-item">${formatter(item)}</div>`).join('')
      : '<div class="list-item">No records available yet.</div>';
  };

  renderList('familyMembers', family.members, (member) => `
    <strong>${member.name}</strong>
    <div>${member.role} • ${member.age} years</div>
    <div>Member ID: ${member.memberId}</div>
    <div>Conditions: ${member.conditions.join(', ') || 'None listed'}</div>
    <div>Doctor: ${member.doctor}</div>
  `);

  renderList('appointments', appointments, (appointment) => `
    <strong>${appointment.patient}</strong>
    <div>${appointment.date} • ${appointment.time}</div>
    <div>${appointment.doctor}</div>
    <div>${appointment.type}</div>
  `);

  renderList('medications', medications, (medication) => `
    <strong>${medication.name}</strong>
    <div>${medication.member}</div>
    <div>Dose: ${medication.dose}</div>
    <div>Schedule: ${medication.schedule}</div>
  `);

  renderList('doctors', doctors, (doctor) => `
    <strong>${doctor.name}</strong>
    <div>${doctor.specialty}</div>
    <div>${doctor.clinic}</div>
    <div>Available: ${doctor.available}</div>
  `);
}

async function handleFamilySubmit(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = Object.fromEntries(form.entries());

  const response = await fetch('/api/family-members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    event.target.reset();
    loadData();
  }
}

async function handleAppointmentSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = Object.fromEntries(form.entries());

  const response = await fetch('/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    event.target.reset();
    loadData();
  }
}

document.getElementById('familyForm').addEventListener('submit', handleFamilySubmit);
document.getElementById('appointmentForm').addEventListener('submit', handleAppointmentSubmit);

loadData();
