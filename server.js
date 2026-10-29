const express = require('express');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Prototype storage only. Use a persistent database and a production session store before real use.
const users = new Map();
const familyMembers = [
  { id: 'F001', name: 'Asha Patel', role: 'Primary member', age: 38, memberId: 'MEM-1001', familyCode: 'FAM-2048', conditions: ['Hypothyroidism'], medications: ['Levothyroxine'], doctor: 'Dr. Mehta' },
  { id: 'F002', name: 'Rohit Patel', role: 'Dependent', age: 11, memberId: 'MEM-1002', familyCode: 'FAM-2048', conditions: ['Asthma'], medications: ['Inhaler'], doctor: 'Dr. Sharma' },
  { id: 'F003', name: 'Mohan Patel', role: 'Caregiver', age: 67, memberId: 'MEM-1003', familyCode: 'FAM-2048', conditions: ['Arthritis'], medications: ['Ibuprofen'], doctor: 'Dr. Nair' }
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

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, user) {
  const candidate = crypto.scryptSync(password, user.salt, 64);
  const original = Buffer.from(user.hash, 'hex');
  return candidate.length === original.length && crypto.timingSafeEqual(candidate, original);
}
function addUser({ name, email, password, demo = false }) {
  const normalizedEmail = email.trim().toLowerCase();
  const derived = hashPassword(password);
  users.set(normalizedEmail, { name, email: normalizedEmail, ...derived, demo });
  return users.get(normalizedEmail);
}
// Sample-only accounts. Do not use these credentials for a real service.
addUser({ name: 'Alex Demo', email: 'admin@demo.com', password: 'admin123', demo: true });
addUser({ name: 'Casey Demo', email: 'client@demo.com', password: 'client123', demo: true });

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(session({
  name: 'healthcare.sid',
  secret: process.env.SESSION_SECRET || 'local-development-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please sign in to access your healthcare workspace.' });
  next();
}
function publicUser(user) {
  return { name: user.name, email: user.email, demo: Boolean(user.demo) };
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Family Healthcare OS' }));
app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not signed in' });
  res.json({ user: req.session.user });
});
app.post('/api/auth/login', (req, res, next) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = users.get(email);
  if (!user || !verifyPassword(password, user)) {
    return res.status(401).json({ error: 'We couldn’t sign you in with those details. Please check and try again.' });
  }
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = publicUser(user);
    req.session.save((saveErr) => saveErr ? next(saveErr) : res.json({ user: req.session.user }));
  });
});
app.post('/api/auth/register', (req, res, next) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'Please enter your full name.' });
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Your password must be between 8 and 128 characters.' });
  if (users.has(email)) return res.status(409).json({ error: 'An account with this email already exists. Try signing in instead.' });
  const user = addUser({ name, email, password });
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = publicUser(user);
    req.session.save((saveErr) => saveErr ? next(saveErr) : res.status(201).json({ user: req.session.user }));
  });
});
app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('healthcare.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction });
    res.status(204).end();
  });
});

app.use('/api', requireAuth);
app.get('/api/family', (req, res) => res.json({ familyCode: 'FAM-2048', members: familyMembers }));
app.get('/api/appointments', (req, res) => res.json(appointments));
app.get('/api/medications', (req, res) => res.json(medications));
app.get('/api/doctors', (req, res) => res.json(doctors));

app.post('/api/family-members', (req, res) => {
  const { name, role, age, conditions, medications: memberMeds, doctor } = req.body;
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Name is required.' });
  const newMember = {
    id: `F${String(familyMembers.length + 1).padStart(3, '0')}`,
    name: String(name).trim().slice(0, 100),
    role: ['Primary member', 'Dependent', 'Caregiver'].includes(role) ? role : 'Dependent',
    age: Math.max(0, Math.min(130, Number(age) || 0)),
    memberId: `MEM-${Date.now()}`,
    familyCode: 'FAM-2048',
    conditions: String(conditions || '').slice(0, 500).split(',').map((item) => item.trim()).filter(Boolean),
    medications: String(memberMeds || '').slice(0, 500).split(',').map((item) => item.trim()).filter(Boolean),
    doctor: String(doctor || 'TBD').slice(0, 100)
  };
  familyMembers.push(newMember);
  res.status(201).json(newMember);
});
app.post('/api/appointments', (req, res) => {
  const { patient, doctor, date, time, type } = req.body;
  if (![patient, doctor, date, time].every((value) => String(value || '').trim())) {
    return res.status(400).json({ error: 'Patient, doctor, date and time are required.' });
  }
  const newAppointment = {
    id: `A${String(appointments.length + 1).padStart(3, '0')}`,
    patient: String(patient).slice(0, 100), doctor: String(doctor).slice(0, 100),
    date: String(date).slice(0, 10), time: String(time).slice(0, 40),
    type: String(type || 'Consultation').slice(0, 100)
  };
  appointments.push(newAppointment);
  res.status(201).json(newAppointment);
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Healthcare OS app running at http://localhost:${PORT}`));
