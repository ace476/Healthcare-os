const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kkmuqehbjhanqckcjqzg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable__jVrv1azwHk_ZLyeVD2ZLQ_hfEKqg8u';

app.disable('x-powered-by');
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


const signupAttempts = new Map();
function allowSignupAttempt(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const current = signupAttempts.get(ip);
  if (!current || now - current.startedAt >= windowMs) {
    signupAttempts.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= 5) return false;
  current.count += 1;
  if (signupAttempts.size > 5000) {
    for (const [key, value] of signupAttempts) {
      if (now - value.startedAt >= windowMs) signupAttempts.delete(key);
    }
  }
  return true;
}

async function isCompromisedPassword(password) {
  const hash = require('crypto').createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetch('https://api.pwnedpasswords.com/range/' + prefix, {
    headers: {
      'User-Agent': 'Healthcare-OS-Password-Check/1.0',
      'Add-Padding': 'true'
    },
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error('Password screening service unavailable');
  const lines = (await response.text()).split(/\r?\n/);
  return lines.some(line => {
    const [candidate, count] = line.trim().split(':');
    return candidate?.toUpperCase() === suffix && Number(count) > 0;
  });
}

// Signup is deliberately public, but password screening happens on the server
// before the password is sent to Supabase Auth.
app.post('/api/auth/signup', asyncRoute(async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString().split(',')[0].trim();
  if (!allowSignupAttempt(ip)) return res.status(429).json({ error: 'Too many sign-up attempts. Please wait 15 minutes and try again.' });

  const name = text(req.body?.full_name, 80);
  const email = text(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (name.length < 2) return res.status(400).json({ error: 'Enter your full name (at least 2 characters).' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Your password must contain between 8 and 128 characters.' });

  let compromised;
  try {
    compromised = await isCompromisedPassword(password);
  } catch (_error) {
    return res.status(503).json({ error: 'We could not check this password safely right now. Please try again in a moment.' });
  }
  if (compromised) return res.status(400).json({ error: 'This password has appeared in known data breaches. Please choose a different password.' });

  const signupClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data, error } = await signupClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } }
  });
  if (error) return res.status(400).json({ error: error.message || 'Unable to create your account. Please try again.' });
  res.set('Cache-Control', 'no-store');
  return res.status(201).json({ user: data.user, session: data.session || null });
}));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'Healthcare OS', timestamp: new Date().toISOString() }));

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
  const notes = [text(req.body.conditions, 300), text(req.body.medications, 300), text(req.body.doctor, 160) ? 'Doctor: ' + text(req.body.doctor,160) : ''].filter(Boolean).join('; ');
  const age = Number(req.body.age);
  let date_of_birth = null;
  if (Number.isInteger(age) && age >= 0 && age <= 125) {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - age);
    date_of_birth = d.toISOString().slice(0,10);
  }
  const { data, error } = await req.supabase.from('family_members').insert({
    family_id: allowed.family_id, display_name: name, relationship: text(req.body.role,40) || 'Dependent',
    date_of_birth, notes: notes || null
  }).select('id,display_name,relationship,date_of_birth,notes').single();
  if (error) throw error;
  res.status(201).json({ id:data.id, name:data.display_name, role:data.relationship, age:dateAge(data.date_of_birth) ?? '', conditions: text(req.body.conditions,300).split(',').filter(Boolean), medications: text(req.body.medications,300).split(',').filter(Boolean), doctor:text(req.body.doctor,160) });
}));

const APPOINTMENT_TIME_ZONE = 'Asia/Kolkata';
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
  const writable=memberships.find(m=>['owner','admin','caregiver'].includes(m.role));
  if(!writable) return res.status(403).json({error:'You do not have permission to schedule appointments.'});
  const patientId=text(req.body.patient_id,80), doctor=text(req.body.doctor,120);
  const date=text(req.body.date,10), time=text(req.body.time,5);
  const startsAt=parseAppointmentStart(date,time);
  if(!patientId||!doctor||!startsAt) return res.status(400).json({error:'Choose a family member and enter a valid date and time.'});
  const {data:member,error:memberError}=await req.supabase.from('family_members').select('id,display_name').eq('id',patientId).eq('family_id',writable.family_id).maybeSingle();
  if(memberError) throw memberError;
  if(!member) return res.status(400).json({error:'Choose a patient from your family workspace.'});
  if(startsAt.getTime() < Date.now() - 60 * 1000) return res.status(400).json({error:'Choose a future appointment date and time.'});
  const {data,error}=await req.supabase.from('appointments').insert({
    family_id:writable.family_id,family_member_id:member.id,title:text(req.body.type,100)||'Consultation',
    clinician_name:doctor,clinic_name:text(req.body.clinic,160)||null,starts_at:startsAt.toISOString(),status:'scheduled'
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
    req.supabase.from('medications').select('id,family_id,family_member_id,name,dosage,instructions,status').in('family_id',ids).order('created_at',{ascending:false}),
    req.supabase.from('family_members').select('id,display_name').in('family_id',ids)
  ]);
  if(error) throw error;if(memberError) throw memberError;
  const byId=new Map((members||[]).map(m=>[m.id,m.display_name]));
  res.set('Cache-Control','private, no-store');
  res.json((rows||[]).map(m=>({id:m.id,name:m.name,member:byId.get(m.family_member_id)||'Family member',dose:m.dosage||'',schedule:m.instructions||'',status:m.status})));
}));

app.get('/api/doctors', asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id),ids=memberships.map(m=>m.family_id);
  const {data,error}=await req.supabase.from('care_team').select('id,family_id,name,specialty,organization,phone,email').in('family_id',ids).order('name');
  if(error) throw error;
  res.set('Cache-Control','private, no-store');
  res.json((data||[]).map(d=>({id:d.id,name:d.name,specialty:d.specialty||'',clinic:d.organization||'',available:d.phone||d.email||''})));
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

for (const [route, table, columns, sortColumn] of [
  ['/api/health-metrics','health_metrics','id,family_id,family_member_id,metric_name,value_numeric,value_text,unit,measured_at','created_at'],
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
