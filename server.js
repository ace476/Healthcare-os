const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kkmuqehbjhanqckcjqzg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable__jVrv1azwHk_ZLyeVD2ZLQ_hfEKqg8u';

app.disable('x-powered-by');
// Vercel terminates the public connection before forwarding requests to Express.
// Trust one proxy hop so req.ip resolves to the client address for abuse controls.
app.set('trust proxy', 1);

// Browser security headers. The CSP allows only the app origin plus the
// explicitly required Supabase, jsDelivr and Google Fonts origins.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' https://kkmuqehbjhanqckcjqzg.supabase.co wss://kkmuqehbjhanqckcjqzg.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com; upgrade-insecure-requests");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(express.json({ limit: '256kb' }));
app.use(express.static(require('path').join(__dirname, 'public')));

function userClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: 'Bearer ' + token } }
  });
}

async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    const supabase = userClient(match[1]);
    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error || !data?.user) return res.status(401).json({ error: 'Your session is invalid or expired. Please sign in again.' });
    req.supabase = supabase;
    req.user = data.user;
    next();
  } catch (error) {
    console.error('Authentication verification failed:', error.message);
    return res.status(401).json({ error: 'Unable to verify your session. Please sign in again.' });
  }
}

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
async function isCompromisedPassword(password) {
  const hash = require('crypto').createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetch('https://api.pwnedpasswords.com/range/' + prefix, {
    headers: { 'User-Agent': 'Healthcare-OS-Password-Check/1.0', 'Add-Padding': 'true' },
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error('Password screening service unavailable');
  const lines = (await response.text()).split(/\r?\n/);
  return lines.some(line => {
    const [candidate, count] = line.trim().split(':');
    return candidate?.toUpperCase() === suffix && Number(count) > 0;
  });
}

const fail = (res, error) => {
  console.error('Healthcare OS database request failed:', error.message);
  return res.status(400).json({ error: 'The request could not be completed. Please check your information and try again.' });
};
const text = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const dateAge = date => {
  if (!date) return null;
  const birth = new Date(date + 'T00:00:00Z');
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age--;
  return age;
};
async function getFamilyIds(supabase, userId) {
  const { data, error } = await supabase.from('family_memberships').select('family_id, role').eq('user_id', userId);
  if (error) throw error;
  return data || [];
}
async function ensureWorkspace(supabase, user) {
  let memberships = await getFamilyIds(supabase, user.id);
  if (!memberships.length) {
    const baseName = text(user.user_metadata?.full_name, 80) || (user.email ? user.email.split('@')[0] : 'My');
    const name = baseName.toLowerCase().endsWith('family') ? baseName : baseName + ' Family';
    const { error } = await supabase.from('families').insert({ name, created_by: user.id });
    // Another request/tab may have created the workspace first. The trigger
    // serializes owner creation; reuse that membership instead of duplicating it.
    memberships = await getFamilyIds(supabase, user.id);
    if (error && !memberships.length) throw error;
  }
  return memberships;
}


// Public-demo release: account creation is paused. Visitors can explore the
// isolated fictional demo without creating an account or entering patient data.
// Existing registered users can still sign in to their private workspace.
app.post('/api/auth/signup', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.status(403).json({ error: 'New account registration is paused while Healthcare OS is presented as a public demo. Please explore the sample workspace or sign in to an existing account.' });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'Healthcare OS', timestamp: new Date().toISOString() }));
app.post('/api/auth/password-check', requireAuth, asyncRoute(async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'Choose a password between 12 and 128 characters.' });
  }
  let compromised;
  try {
    compromised = await isCompromisedPassword(password);
  } catch (_error) {
    return res.status(503).json({ error: 'We could not screen this password safely right now. Please try again.' });
  }
  res.set('Cache-Control', 'no-store');
  return res.json({ compromised });
}));


// Every application-data endpoint below requires a verified Supabase user token.
// The same user token is forwarded to Postgres, so database RLS remains in force.
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  return requireAuth(req, res, next);
});

app.get('/api/me', asyncRoute(async (req, res) => {
  const { data: profile } = await req.supabase.from('profiles').select('full_name').eq('id', req.user.id).maybeSingle();
  res.set('Cache-Control', 'private, no-store');
  res.json({ id: req.user.id, email: req.user.email, name: profile?.full_name || req.user.user_metadata?.full_name || '' });
}));

app.get('/api/family', asyncRoute(async (req, res) => {
  const memberships = await ensureWorkspace(req.supabase, req.user);
  const ids = memberships.map(m => m.family_id);
  const [{ data: families, error: familyError }, { data: members, error: memberError }] = await Promise.all([
    req.supabase.from('families').select('id,name').in('id', ids),
    req.supabase.from('family_members').select('id,family_id,display_name,date_of_birth,relationship,notes,created_at').in('family_id', ids).order('created_at')
  ]);
  if (familyError) throw familyError;
  if (memberError) throw memberError;
  const family = families?.[0];
  const mapped = (members || []).map(m => {
    const notes = m.notes || '';
    return { id: m.id, name: m.display_name, role: m.relationship || 'Family member', age: dateAge(m.date_of_birth) ?? '', conditions: notes ? notes.split(';').filter(Boolean) : [], medications: [], doctor: '', familyId: m.family_id };
  });
  res.set('Cache-Control', 'private, no-store');
  res.json({ familyCode: family?.id || null, familyName: family?.name || null, families: families || [], members: mapped });
}));

app.post('/api/family-members', asyncRoute(async (req, res) => {
  const memberships = await getFamilyIds(req.supabase, req.user.id);
  const allowed = memberships.find(m => ['owner','admin','caregiver'].includes(m.role));
  if (!allowed) return res.status(403).json({ error: 'You do not have permission to add family members.' });
  const name = text(req.body.name, 100);
  if (name.length < 2) return res.status(400).json({ error: 'Enter a valid family member name.' });
  const dob = text(req.body.date_of_birth, 10);
  let date_of_birth = null;
  if (dob) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return res.status(400).json({ error: 'Enter a valid date of birth.' });
    const parsed = new Date(dob + 'T00:00:00Z');
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== dob || parsed > new Date()) return res.status(400).json({ error: 'Date of birth must be a valid date in the past.' });
    date_of_birth = dob;
  } else if (req.body.age !== undefined && req.body.age !== '') {
    const age = Number(req.body.age);
    if (!Number.isInteger(age) || age < 0 || age > 125) return res.status(400).json({ error: 'Enter a valid age.' });
    const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - age); date_of_birth = d.toISOString().slice(0,10);
  }
  const notes = text(req.body.notes, 1000) || [
    text(req.body.conditions, 300), text(req.body.medications, 300),
    text(req.body.doctor, 160) ? 'Doctor: ' + text(req.body.doctor,160) : ''
  ].filter(Boolean).join('; ');
  const { data, error } = await req.supabase.from('family_members').insert({
    family_id: allowed.family_id, display_name: name, relationship: text(req.body.role,40) || 'Dependent',
    date_of_birth, notes: notes || null
  }).select('id,display_name,relationship,date_of_birth,notes').single();
  if (error) throw error;
  res.status(201).json({ id:data.id, name:data.display_name, role:data.relationship, age:dateAge(data.date_of_birth) ?? '', conditions: notes ? [notes] : [] });
}));

const APPOINTMENT_TIME_ZONE = 'Asia/Kolkata';
function parseLocalIST(value) {
  if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$/.test(value)) return null;
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 ||
      calendarCheck.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  const parsed = new Date(value + ':00+05:30');
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function appointmentLocalParts(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APPOINTMENT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}
function parseAppointmentStart(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (hour > 23 || minute > 59) return null;
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 || calendarCheck.getUTCDate() !== day) return null;
  // The appointment form uses Asia/Kolkata local time (UTC+05:30).
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 330 * 60 * 1000);
}
app.get('/api/appointments', asyncRoute(async (req,res) => {
  const memberships = await getFamilyIds(req.supabase, req.user.id);
  const ids = memberships.map(m=>m.family_id);
  const [{data:rows,error},{data:members, error:memberError}] = await Promise.all([
    req.supabase.from('appointments').select('id,family_id,family_member_id,title,clinician_name,clinic_name,starts_at,status,notes').in('family_id',ids).order('starts_at'),
    req.supabase.from('family_members').select('id,display_name').in('family_id',ids)
  ]);
  if(error) throw error; if(memberError) throw memberError;
  const byId = new Map((members||[]).map(m=>[m.id,m.display_name]));
  res.set('Cache-Control','private, no-store');
  res.json((rows||[]).map(a => {
    const local = appointmentLocalParts(a.starts_at);
    return {
      id:a.id, patient:byId.get(a.family_member_id)||'Family member', doctor:a.clinician_name||'',
      date:local.year+'-'+local.month+'-'+local.day, time:new Date(a.starts_at).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',timeZone:APPOINTMENT_TIME_ZONE}),
      type:a.title, status:a.status, clinic:a.clinic_name||''
    };
  }));
}));

app.post('/api/appointments', asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id);
  const patientId=text(req.body.patient_id,80), doctor=text(req.body.doctor,120);
  const date=text(req.body.date,10), time=text(req.body.time,5);
  const startsAt=parseAppointmentStart(date,time);
  if(!patientId||!doctor||!startsAt) return res.status(400).json({error:'Choose a family member and enter a valid date and time.'});
  const {data:member,error:memberError}=await req.supabase.from('family_members').select('id,display_name,family_id').eq('id',patientId).maybeSingle();
  if(memberError) throw memberError;
  if(!member) return res.status(400).json({error:'Choose a patient from your family workspace.'});
  const writable=memberships.find(m=>m.family_id===member.family_id && ['owner','admin','caregiver'].includes(m.role));
  if(!writable) return res.status(403).json({error:'You do not have permission to schedule appointments for this family member.'});
  if(startsAt.getTime() < Date.now() - 60 * 1000) return res.status(400).json({error:'Choose a future appointment date and time.'});
  const {data,error}=await req.supabase.from('appointments').insert({
    family_id:writable.family_id,family_member_id:member.id,title:text(req.body.type,100)||'Consultation',
    clinician_name:doctor,clinic_name:text(req.body.clinic,160)||null,starts_at:startsAt.toISOString(),status:'scheduled',created_by:req.user.id
  }).select('id,title,clinician_name,starts_at,status').single();
  if(error) throw error;
  const local=appointmentLocalParts(data.starts_at);
  res.status(201).json({
    id:data.id,patient:member.display_name,doctor:data.clinician_name,date:local.year+'-'+local.month+'-'+local.day,
    time:new Date(data.starts_at).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',timeZone:APPOINTMENT_TIME_ZONE}),
    type:data.title,status:data.status
  });
}));

app.patch('/api/appointments/:id/cancel', asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id);
  const writable=memberships.filter(m=>['owner','admin','caregiver'].includes(m.role));
  if(!writable.length) return res.status(403).json({error:'You do not have permission to cancel appointments.'});
  const ids=writable.map(m=>m.family_id);
  const {data,error}=await req.supabase.from('appointments').update({status:'cancelled'})
    .eq('id',req.params.id).in('family_id',ids).eq('status','scheduled')
    .select('id,status').maybeSingle();
  if(error) throw error;
  if(!data) return res.status(404).json({error:'This scheduled appointment was not found or has already been updated.'});
  res.set('Cache-Control','private, no-store');
  res.json({id:data.id,status:data.status});
}));

app.get('/api/medications', asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id), ids=memberships.map(m=>m.family_id);
  const [{data:rows,error},{data:members,error:memberError}]=await Promise.all([
    req.supabase.from('medications').select('id,family_id,family_member_id,name,dosage,instructions,start_date,end_date,status').in('family_id',ids).order('created_at',{ascending:false}),
    req.supabase.from('family_members').select('id,display_name').in('family_id',ids)
  ]);
  if(error) throw error;if(memberError) throw memberError;
  const byId=new Map((members||[]).map(m=>[m.id,m.display_name]));
  res.set('Cache-Control','private, no-store');
  res.json((rows||[]).map(m=>({id:m.id,name:m.name,member:byId.get(m.family_member_id)||'Family member',familyMemberId:m.family_member_id,dose:m.dosage||'',schedule:m.instructions||'',startDate:m.start_date||'',endDate:m.end_date||'',status:m.status})));
}));

app.post('/api/medications', asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id);
  const patientId=text(req.body.patient_id,80), name=text(req.body.name,160);
  if(!patientId||name.length<2) return res.status(400).json({error:'Choose a family member and enter a medication name.'});
  const {data:member,error:memberError}=await req.supabase.from('family_members').select('id,family_id').eq('id',patientId).maybeSingle();
  if(memberError) throw memberError;
  if(!member) return res.status(400).json({error:'Choose a member in your family workspace.'});
  const writable=memberships.find(m=>m.family_id===member.family_id && ['owner','admin','caregiver'].includes(m.role));
  if(!writable) return res.status(403).json({error:'You do not have permission to add medication for this member.'});
  const start=text(req.body.start_date,10)||null, end=text(req.body.end_date,10)||null;
  const validDate=value=>!value||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(value+'T00:00:00Z').getTime())&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value);
  if(!validDate(start)||!validDate(end)||(start&&end&&end<start)) return res.status(400).json({error:'Check the medication start and end dates.'});
  const {data,error}=await req.supabase.from('medications').insert({
    family_id:writable.family_id,family_member_id:member.id,name,dosage:text(req.body.dosage,120)||null,
    instructions:text(req.body.instructions,240)||null,start_date:start,end_date:end,status:'active',created_by:req.user.id
  }).select('id,name,dosage,instructions,start_date,end_date,status').single();
  if(error) throw error;
  res.status(201).json({id:data.id,name:data.name,dose:data.dosage||'',schedule:data.instructions||'',startDate:data.start_date||'',endDate:data.end_date||'',status:data.status});
}));

app.get('/api/doctors', asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id),ids=memberships.map(m=>m.family_id);
  const {data,error}=await req.supabase.from('care_team').select('id,family_id,family_member_id,name,specialty,organization,phone,email,notes').in('family_id',ids).order('name');
  if(error) throw error;
  res.set('Cache-Control','private, no-store');
  res.json((data||[]).map(d=>({id:d.id,name:d.name,specialty:d.specialty||'',clinic:d.organization||'',phone:d.phone||'',email:d.email||'',available:d.phone||d.email||'',familyMemberId:d.family_member_id,notes:d.notes||''})));
}));

app.post('/api/doctors', asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id);
  const name=text(req.body.name,160);
  if(name.length<2) return res.status(400).json({error:'Enter the healthcare professional name.'});
  const patientId=text(req.body.patient_id,80);
  let familyId;
  if(patientId){
    const {data:member,error:memberError}=await req.supabase.from('family_members').select('id,family_id').eq('id',patientId).maybeSingle();
    if(memberError) throw memberError;
    if(!member) return res.status(400).json({error:'Choose a family member in your workspace.'});
    familyId=member.family_id;
  } else familyId=memberships.find(m=>['owner','admin','caregiver'].includes(m.role))?.family_id;
  const writable=memberships.find(m=>m.family_id===familyId && ['owner','admin','caregiver'].includes(m.role));
  if(!writable) return res.status(403).json({error:'You do not have permission to add care contacts for this family.'});
  const {data,error}=await req.supabase.from('care_team').insert({
    family_id:familyId,family_member_id:patientId||null,name,specialty:text(req.body.specialty,120)||null,
    organization:text(req.body.organization,160)||null,phone:text(req.body.phone,40)||null,email:text(req.body.email,254)||null,
    notes:text(req.body.notes,600)||null
  }).select('id,name,specialty,organization,phone,email,family_member_id,notes').single();
  if(error) throw error;
  res.status(201).json({id:data.id,name:data.name,specialty:data.specialty||'',clinic:data.organization||'',phone:data.phone||'',email:data.email||'',available:data.phone||data.email||'',familyMemberId:data.family_member_id,notes:data.notes||''});
}));

app.get('/api/medical-records', asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id),ids=memberships.map(m=>m.family_id);
  const {data,error}=await req.supabase.from('medical_records').select('id,family_id,family_member_id,title,category,document_date,original_filename,mime_type,byte_size,storage_path').in('family_id',ids).order('created_at',{ascending:false});
  if(error) throw error;
  res.set('Cache-Control','private, no-store');
  res.json((data||[]).map(r=>({id:r.id,title:r.title,category:r.category,member:'Family member',date:r.document_date||'',originalName:r.original_filename,mimeType:r.mime_type,size:r.byte_size,source:'stored'})));
}));
app.post('/api/medical-records',(_req,res)=>res.status(501).json({error:'Private uploads are being connected to authenticated storage. Uploads are not enabled yet.'}));
app.get('/api/medical-records/:id/download',(_req,res)=>res.status(501).json({error:'Secure document downloads are not enabled yet.'}));


app.post('/api/health-metrics', asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id);
  const patientId=text(req.body.patient_id,80);
  const metric=text(req.body.metric_name,40);
  const allowedMetrics=new Set(['blood_pressure','heart_rate','temperature','oxygen_saturation','weight','blood_glucose']);
  if(!patientId||!allowedMetrics.has(metric)) return res.status(400).json({error:'Choose a family member and a supported measurement type.'});
  const {data:member,error:memberError}=await req.supabase.from('family_members').select('id,family_id').eq('id',patientId).maybeSingle();
  if(memberError) throw memberError;
  if(!member) return res.status(400).json({error:'Choose a member in your family workspace.'});
  const writable=memberships.find(m=>m.family_id===member.family_id && ['owner','admin','caregiver'].includes(m.role));
  if(!writable) return res.status(403).json({error:'You do not have permission to record measurements for this member.'});
  const measuredAt=req.body.measured_at?parseLocalIST(req.body.measured_at):new Date();
  if(!measuredAt||Number.isNaN(measuredAt.getTime())||measuredAt.getTime()>Date.now()+5*60*1000) return res.status(400).json({error:'Enter a valid measurement date and time.'});
  const isPressure=metric==='blood_pressure';
  const raw=isPressure?text(req.body.value_text,40):req.body.value_numeric;
  if(isPressure){
    if(!/^\d{2,3}\s*\/\s*\d{2,3}$/.test(raw)) return res.status(400).json({error:'Enter blood pressure as systolic/diastolic, for example 120/80.'});
  } else if(raw===''||raw===null||raw===undefined||!Number.isFinite(Number(raw))) {
    return res.status(400).json({error:'Enter a numeric measurement.'});
  }
  const unit=text(req.body.unit,24);
  const {data,error}=await req.supabase.from('health_metrics').insert({
    family_id:writable.family_id,family_member_id:member.id,metric_name:metric,
    value_numeric:isPressure?null:Number(raw),value_text:isPressure?raw:null,
    unit:unit||null,measured_at:measuredAt.toISOString(),notes:text(req.body.notes,500)||null,
    created_by:req.user.id
  }).select('id,metric_name,value_numeric,value_text,unit,measured_at,notes').single();
  if(error) throw error;
  res.set('Cache-Control','private, no-store');
  res.status(201).json(data);
}));

app.get('/api/medication-dose-logs',asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id),ids=memberships.map(m=>m.family_id);
  const [{data:logs,error},{data:medications,error:medError},{data:members,error:memberError}]=await Promise.all([
    req.supabase.from('medication_dose_logs').select('id,family_id,family_member_id,medication_id,scheduled_for,status,taken_at,note,created_at,logged_by').in('family_id',ids).order('scheduled_for',{ascending:false}).limit(100),
    req.supabase.from('medications').select('id,name').in('family_id',ids),
    req.supabase.from('family_members').select('id,display_name').in('family_id',ids)
  ]);
  if(error) throw error;if(medError) throw medError;if(memberError) throw memberError;
  const medMap=new Map((medications||[]).map(m=>[m.id,m.name]));
  const memberMap=new Map((members||[]).map(m=>[m.id,m.display_name]));
  res.set('Cache-Control','private, no-store');
  res.json((logs||[]).map(log=>({...log,medication_name:medMap.get(log.medication_id)||'Medication',member_name:memberMap.get(log.family_member_id)||'Family member'})));
}));

app.post('/api/medication-dose-logs',asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id);
  const medicationId=text(req.body.medication_id,80);
  const status=text(req.body.status,16);
  const scheduledFor=req.body.scheduled_for?parseLocalIST(req.body.scheduled_for):null;
  if(!medicationId||!['taken','missed','skipped'].includes(status)||!scheduledFor||Number.isNaN(scheduledFor.getTime())||scheduledFor.getTime()>Date.now()+5*60*1000){
    return res.status(400).json({error:'Choose a medication, a valid scheduled time, and a dose status.'});
  }
  const {data:medication,error:medError}=await req.supabase.from('medications').select('id,family_id,family_member_id,name').eq('id',medicationId).maybeSingle();
  if(medError) throw medError;
  if(!medication||!medication.family_member_id) return res.status(400).json({error:'Choose a medication linked to a family member.'});
  const writable=memberships.find(m=>m.family_id===medication.family_id&&['owner','admin','caregiver'].includes(m.role));
  if(!writable) return res.status(403).json({error:'You do not have permission to record this medication dose.'});
  const {data,error}=await req.supabase.from('medication_dose_logs').insert({
    family_id:medication.family_id,family_member_id:medication.family_member_id,medication_id:medication.id,
    scheduled_for:scheduledFor.toISOString(),status,taken_at:status==='taken'?new Date().toISOString():null,
    note:text(req.body.note,500)||null,logged_by:req.user.id
  }).select('id,medication_id,family_member_id,scheduled_for,status,taken_at,note,created_at').single();
  if(error&&error.code==='23505') return res.status(409).json({error:'A dose record already exists for this medication and scheduled time.'});
  if(error) throw error;
  res.set('Cache-Control','private, no-store');
  res.status(201).json({...data,medication_name:medication.name});
}));

app.get('/api/health-timeline',asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id),ids=memberships.map(m=>m.family_id);
  const [{data:metrics,error:metricError},{data:doses,error:doseError},{data:appointments,error:appointmentError},{data:members,error:memberError},{data:medications,error:medError}]=await Promise.all([
    req.supabase.from('health_metrics').select('id,family_id,family_member_id,metric_name,value_numeric,value_text,unit,measured_at,notes,created_by').in('family_id',ids).order('measured_at',{ascending:false}).limit(100),
    req.supabase.from('medication_dose_logs').select('id,family_id,family_member_id,medication_id,scheduled_for,status,taken_at,note,logged_by').in('family_id',ids).order('scheduled_for',{ascending:false}).limit(100),
    req.supabase.from('appointments').select('id,family_id,family_member_id,title,clinician_name,starts_at,status').in('family_id',ids).order('starts_at',{ascending:false}).limit(100),
    req.supabase.from('family_members').select('id,display_name').in('family_id',ids),
    req.supabase.from('medications').select('id,name').in('family_id',ids)
  ]);
  if(metricError) throw metricError;if(doseError) throw doseError;if(appointmentError) throw appointmentError;if(memberError) throw memberError;if(medError) throw medError;
  const memberMap=new Map((members||[]).map(m=>[m.id,m.display_name]));
  const medMap=new Map((medications||[]).map(m=>[m.id,m.name]));
  const events=[
    ...(metrics||[]).map(m=>({id:'metric-'+m.id,type:'measurement',at:m.measured_at,member:memberMap.get(m.family_member_id)||'Family',title:m.metric_name.replace(/_/g,' '),detail:[m.value_text||m.value_numeric,m.unit].filter(v=>v!==null&&v!==undefined&&v!=='').join(' '),note:m.notes||''})),
    ...(doses||[]).map(d=>({id:'dose-'+d.id,type:'medication',at:d.scheduled_for,member:memberMap.get(d.family_member_id)||'Family',title:medMap.get(d.medication_id)||'Medication',detail:'Dose '+d.status,note:d.note||''})),
    ...(appointments||[]).map(a=>({id:'appointment-'+a.id,type:'appointment',at:a.starts_at,member:memberMap.get(a.family_member_id)||'Family',title:a.title,detail:[a.clinician_name,a.status].filter(Boolean).join(' · '),note:''}))
  ];
  events.sort((a,b)=>new Date(b.at)-new Date(a.at));
  res.set('Cache-Control','private, no-store');
  res.json(events.slice(0,150));
}));


app.get('/api/health-metrics',asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id),ids=memberships.map(m=>m.family_id);
  const [{data:rows,error},{data:members,error:memberError}]=await Promise.all([
    req.supabase.from('health_metrics').select('id,family_id,family_member_id,metric_name,value_numeric,value_text,unit,measured_at,notes,created_by').in('family_id',ids).order('measured_at',{ascending:false}).limit(100),
    req.supabase.from('family_members').select('id,display_name').in('family_id',ids)
  ]);
  if(error) throw error;if(memberError) throw memberError;
  const names=new Map((members||[]).map(m=>[m.id,m.display_name]));
  res.set('Cache-Control','private, no-store');
  res.json((rows||[]).map(row=>({...row,member_name:names.get(row.family_member_id)||'Family member'})));
}));

for (const [route, table, columns, sortColumn] of [
  ['/api/emergency-info','emergency_info','id,family_id,family_member_id,blood_group,allergies,emergency_contact_name,emergency_contact_phone,conditions','updated_at'],
  ['/api/notifications','notifications','id,family_id,title,body,kind,read_at,created_at','created_at']
]) {
  app.get(route, asyncRoute(async(req,res)=>{
    const memberships=await getFamilyIds(req.supabase,req.user.id),ids=memberships.map(m=>m.family_id);
    const {data,error}=await req.supabase.from(table).select(columns).in('family_id',ids).order(sortColumn,{ascending:false}).limit(100);
    if(error) throw error;
    res.set('Cache-Control','private, no-store');
    res.json(data||[]);
  }));
}

app.get('*',(req,res)=>res.sendFile(require('path').join(__dirname,'public','index.html')));
app.use((err,req,res,_next)=>{
  console.error('Healthcare OS request error:',err.message);
  if(res.headersSent) return;
  if(err.code==='PGRST301'||err.status===401) return res.status(401).json({error:'Please sign in again.'});
  res.status(400).json({error:'The server could not complete this request.'});
});
app.listen(PORT,()=>console.log('Healthcare OS server running on port '+PORT));
