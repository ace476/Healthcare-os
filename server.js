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
    const name = text(user.user_metadata?.full_name, 80) || (user.email ? user.email.split('@')[0] : 'My') + "'s family";
    const { error } = await supabase.rpc('create_family_workspace', { p_name: name + (name.toLowerCase().endsWith('family') ? '' : ' Family') });
    if (error) throw error;
    memberships = await getFamilyIds(supabase, user.id);
  }
  return memberships;
}

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
  const memberships = await getFamilyIds(req.supabase, req.user.id);
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

app.get('/api/appointments', asyncRoute(async (req,res) => {
  const memberships = await ensureWorkspace(req.supabase, req.user);
  const ids = memberships.map(m=>m.family_id);
  const [{data:rows,error},{data:members, error:memberError}] = await Promise.all([
    req.supabase.from('appointments').select('id,family_id,family_member_id,title,clinician_name,starts_at,status,notes').in('family_id',ids).order('starts_at'),
    req.supabase.from('family_members').select('id,display_name').in('family_id',ids)
  ]);
  if(error) throw error; if(memberError) throw memberError;
  const byId = new Map((members||[]).map(m=>[m.id,m.display_name]));
  res.set('Cache-Control','private, no-store');
  res.json((rows||[]).map(a=>({id:a.id,patient:byId.get(a.family_member_id)||'Family member',doctor:a.clinician_name||'',date:a.starts_at.slice(0,10),time:new Date(a.starts_at).toLocaleTimeString('en',{hour:'numeric',minute:'2-digit',timeZone:'UTC'}),type:a.title,status:a.status})));
}));

app.post('/api/appointments', asyncRoute(async(req,res)=>{
  const memberships=await getFamilyIds(req.supabase,req.user.id);
  const writable=memberships.find(m=>['owner','admin','caregiver'].includes(m.role));
  if(!writable) return res.status(403).json({error:'You do not have permission to schedule appointments.'});
  const patient=text(req.body.patient,100), doctor=text(req.body.doctor,120), date=text(req.body.date,10), time=text(req.body.time,20);
  if(!patient||!doctor||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!time) return res.status(400).json({error:'Patient, doctor, date and time are required.'});
  const {data:member,error:memberError}=await req.supabase.from('family_members').select('id,display_name').eq('family_id',writable.family_id).ilike('display_name',patient).maybeSingle();
  if(memberError) throw memberError;
  if(!member) return res.status(400).json({error:'Choose a patient already listed in your family workspace.'});
  const dateParts=date.split('-').map(Number);
  const match=time.match(/^(\\d{1,2}):(\\d{2})\\s*(AM|PM)?$/i);
  if(!match) return res.status(400).json({error:'Enter the time as HH:MM AM/PM or 24-hour HH:MM.'});
  let hour=Number(match[1]); const minute=Number(match[2]); const meridiem=(match[3]||'').toUpperCase();
  if(minute>59||hour>(meridiem?12:23)||hour<(meridiem?1:0)) return res.status(400).json({error:'Enter a valid appointment time.'});
  if(meridiem) hour=(hour%12)+(meridiem==='PM'?12:0);
  const [year,month,day]=dateParts;
  const parsed=new Date(Date.UTC(year,month-1,day,hour,minute));
  if(parsed.getUTCFullYear()!==year||parsed.getUTCMonth()!==month-1||parsed.getUTCDate()!==day) return res.status(400).json({error:'Enter a valid appointment date.'});
  const {data,error}=await req.supabase.from('appointments').insert({family_id:writable.family_id,family_member_id:member.id,title:text(req.body.type,100)||'Consultation',clinician_name:doctor,starts_at:parsed.toISOString(),status:'scheduled'}).select('id,title,clinician_name,starts_at,status').single();
  if(error) throw error;
  res.status(201).json({id:data.id,patient:member.display_name,doctor:data.clinician_name,date:data.starts_at.slice(0,10),time,type:data.title,status:data.status});
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
  const memberships=await ensureWorkspace(req.supabase,req.user),ids=memberships.map(m=>m.family_id);
  const {data,error}=await req.supabase.from('care_team').select('id,family_id,name,specialty,organization,phone,email').in('family_id',ids).order('name');
  if(error) throw error;
  res.set('Cache-Control','private, no-store');
  res.json((data||[]).map(d=>({id:d.id,name:d.name,specialty:d.specialty||'',clinic:d.organization||'',available:d.phone||d.email||''})));
}));

app.get('/api/medical-records', asyncRoute(async(req,res)=>{
  const memberships=await ensureWorkspace(req.supabase,req.user),ids=memberships.map(m=>m.family_id);
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
    const memberships=await ensureWorkspace(req.supabase,req.user),ids=memberships.map(m=>m.family_id);
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
