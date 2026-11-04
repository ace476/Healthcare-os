const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

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

app.use(express.json({ limit: '1mb' }));
const uploadDir = path.join(__dirname, 'data', 'uploads');
const recordsFile = path.join(__dirname, 'data', 'medical-records.json');
const hosted = Boolean(process.env.VERCEL);
if (!hosted) fs.mkdirSync(uploadDir, { recursive: true });
const readUploads = () => {
  if (hosted) return [];
  try { return JSON.parse(fs.readFileSync(recordsFile, 'utf8')); } catch { return []; }
};
const writeUploads = rows => {
  fs.mkdirSync(path.dirname(recordsFile), { recursive: true });
  const tmp = recordsFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, recordsFile);
};
const types = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const uploader = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + (types[file.mimetype] || ''))
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!types[file.mimetype] || path.extname(file.originalname).toLowerCase() !== types[file.mimetype]) {
      return cb(new Error('Only matching PDF, JPG, PNG, or WEBP files are accepted.'));
    }
    cb(null, true);
  }
});
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

const medicalRecords=[{title:'Complete blood count',category:'Lab report',member:'Asha Patel',date:'2026-10-18',clinic:'MediCare Clinic'},{title:'Prescription summary',category:'Prescription',member:'Rohit Patel',date:'2026-10-22',clinic:'Sunrise Child Care'},{title:'Discharge summary',category:'Clinical summary',member:'Mohan Patel',date:'2026-09-30',clinic:'CareBridge Hospital'}];
const healthMetrics=[{metric:'Blood pressure',value:'118/76',unit:'mmHg',member:'Asha Patel',date:'2026-11-01'},{metric:'Weight',value:'62',unit:'kg',member:'Asha Patel',date:'2026-10-28'},{metric:'Blood glucose',value:'96',unit:'mg/dL',member:'Mohan Patel',date:'2026-10-27'}];
const emergencyInfo=[{member:'Asha Patel',bloodGroup:'B+',allergies:'Not provided',contact:'Family contact (sample)',phone:'Not provided',conditions:'Hypothyroidism'},{member:'Rohit Patel',bloodGroup:'Not provided',allergies:'Not provided',contact:'Asha Patel (sample)',phone:'Not provided',conditions:'Asthma'},{member:'Mohan Patel',bloodGroup:'Not provided',allergies:'Not provided',contact:'Family contact (sample)',phone:'Not provided',conditions:'Arthritis'}];
const notifications=[{title:'Appointment reminder',detail:'Rohit Patel · Pediatric review',date:'2026-11-04',kind:'Appointment',status:'Upcoming'},{title:'Follow-up to plan',detail:'Mohan Patel · General consultation',date:'2026-11-06',kind:'Care task',status:'To review'},{title:'Review medication list',detail:'Check the sample medication list',date:'2026-11-01',kind:'Reminder',status:'To review'}];
app.get('/api/medical-records', (req, res) => res.json([...readUploads(), ...medicalRecords]));
app.post('/api/medical-records', (req, res, next) => {
  if (hosted) return res.status(503).json({ error: 'Uploads are disabled on the hosted demo until private persistent storage and user access controls are configured.' });
  uploader.single('file')(req, res, err => {
    if (err) return next(err);
    if (!req.file) return res.status(400).json({ error: 'Choose a document to upload.' });
    const { title, category, member, date } = req.body;
    if (!title || !member || !date) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Title, family member, and document date are required.' });
    }
    const record = {
      id: crypto.randomUUID(), title: String(title).trim().slice(0, 120),
      category: String(category || 'Other').slice(0, 40), member: String(member).trim().slice(0, 100),
      date, filename: path.basename(req.file.filename), originalName: path.basename(req.file.originalname).slice(0, 180),
      mimeType: req.file.mimetype, size: req.file.size, uploadedAt: new Date().toISOString(), source: 'uploaded'
    };
    try { const rows = readUploads(); rows.unshift(record); writeUploads(rows); res.status(201).json(record); }
    catch (e) { fs.unlinkSync(req.file.path); next(e); }
  });
});
app.get('/api/medical-records/:id/download', (req, res) => {
  const row = readUploads().find(item => item.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'Document not found.' });
  const file = path.join(uploadDir, path.basename(row.filename));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Stored file is missing.' });
  res.download(file, row.originalName);
});
app.get('/api/health-metrics',(req,res)=>res.json(healthMetrics));
app.get('/api/emergency-info',(req,res)=>res.json(emergencyInfo));
app.get('/api/notifications',(req,res)=>res.json(notifications));

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

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File must be 10 MB or smaller.' : err.message });
  if (err) return res.status(400).json({ error: err.message || 'Request failed.' });
  next();
});
app.listen(PORT, () => {
  console.log(`Healthcare OS app running at http://localhost:${PORT}`);
});
