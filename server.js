const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const familyMembers = [
  {
    id: 'F001',
    name: 'Asha Patel',
    role: 'Primary member',
    age: 38,
    memberId: 'MEM-1001',
    familyCode: 'FAM-2048',
    conditions: ['Hypothyroidism'],
    medications: ['Levothyroxine'],
    doctor: 'Dr. Mehta'
  },
  {
    id: 'F002',
    name: 'Rohit Patel',
    role: 'Dependent',
    age: 11,
    memberId: 'MEM-1002',
    familyCode: 'FAM-2048',
    conditions: ['Asthma'],
    medications: ['Inhaler'],
    doctor: 'Dr. Sharma'
  },
  {
    id: 'F003',
    name: 'Mohan Patel',
    role: 'Caregiver',
    age: 67,
    memberId: 'MEM-1003',
    familyCode: 'FAM-2048',
    conditions: ['Arthritis'],
    medications: ['Ibuprofen'],
    doctor: 'Dr. Nair'
  }
];

const appointments = [
  { id: 'A001', patient: 'Asha Patel', doctor: 'Dr. Mehta', date: '2026-11-02', time: '10:30 AM', type: 'Follow-up' },
  { id: 'A002', patient: 'Rohit Patel', doctor: 'Dr. Sharma', date: '2026-11-04', time: '2:00 PM', type: 'Pediatric review' },
  { id: 'A003', patient: 'Mohan Patel', doctor: 'Dr. Nair', date: '2026-11-06', time: '9:15 AM', type: 'General consultation' }
];

const medications = [
  { name: 'Levothyroxine', dose: '50 mcg', schedule: 'Daily morning', member: 'Asha Patel' },
  { name: 'Inhaler', dose: '1 puff', schedule: 'Twice daily', member: 'Rohit Patel' },
  { name: 'Ibuprofen', dose: '200 mg', schedule: 'As needed', member: 'Mohan Patel' }
];

const doctors = [
  { name: 'Dr. Mehta', specialty: 'Endocrinology', clinic: 'MediCare Clinic', available: 'Mon, Wed, Fri' },
  { name: 'Dr. Sharma', specialty: 'Pediatrics', clinic: 'Sunrise Child Care', available: 'Tue, Thu' },
  { name: 'Dr. Nair', specialty: 'Family Medicine', clinic: 'CareBridge Hospital', available: 'Mon-Fri' }
];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Family Healthcare OS',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/family', (req, res) => {
  res.json({
    familyCode: 'FAM-2048',
    members: familyMembers
  });
});

app.get('/api/appointments', (req, res) => {
  res.json(appointments);
});

app.get('/api/medications', (req, res) => {
  res.json(medications);
});

app.get('/api/doctors', (req, res) => {
  res.json(doctors);
});

app.post('/api/family-members', (req, res) => {
  const { name, role, age, memberId, conditions, medications: memberMeds, doctor } = req.body;

  const newMember = {
    id: `F${String(familyMembers.length + 1).padStart(3, '0')}`,
    name,
    role: role || 'Dependent',
    age: Number(age) || 0,
    memberId: memberId || `MEM-${Date.now()}`,
    familyCode: 'FAM-2048',
    conditions: conditions ? conditions.split(',').map((item) => item.trim()).filter(Boolean) : [],
    medications: memberMeds ? memberMeds.split(',').map((item) => item.trim()).filter(Boolean) : [],
    doctor: doctor || 'TBD'
  };

  familyMembers.push(newMember);
  res.status(201).json(newMember);
});

app.post('/api/appointments', (req, res) => {
  const { patient, doctor, date, time, type } = req.body;

  const newAppointment = {
    id: `A${String(appointments.length + 1).padStart(3, '0')}`,
    patient,
    doctor,
    date,
    time,
    type: type || 'Consultation'
  };

  appointments.push(newAppointment);
  res.status(201).json(newAppointment);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Healthcare OS app running at http://localhost:${PORT}`);
});
