'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const appointments = [
    {id:1,day:11,month:10,title:'Routine follow-up',doctor:'Dr. Meera Shah',specialty:'General physician',clinic:'Sample City Clinic',time:'10:30 AM',status:'confirmed',member:'Alex'},
    {id:2,day:13,month:10,title:'Dental check-up',doctor:'Dr. Kabir Rao',specialty:'Dentist',clinic:'Demo Dental Studio',time:'4:00 PM',status:'scheduled',member:'Riya'},
    {id:3,day:19,month:10,title:'Annual wellness visit',doctor:'Dr. Nisha Menon',specialty:'Family medicine',clinic:'Fictional Wellness Centre',time:'11:15 AM',status:'scheduled',member:'Sam'}
  ];
  const medications = [
    {id:1,name:'Vitamin D3',dose:'1 tablet · 1000 IU',time:'8:00 AM',instruction:'Sample instruction: after breakfast',member:'Alex',refill:'5 days remaining',status:'active'},
    {id:2,name:'Daily multivitamin',dose:'1 tablet',time:'1:00 PM',instruction:'Sample instruction: with lunch',member:'Alex',refill:'18 days remaining',status:'active'},
    {id:3,name:'Calcium supplement',dose:'1 tablet',time:'8:00 PM',instruction:'Sample instruction: with evening meal',member:'Riya',refill:'12 days remaining',status:'active'}
  ];
  const family = [
    {name:'Alex Family',initials:'AF',relation:'Workspace owner',role:'Owner',tone:'teal',activity:'Workspace administrator'},
    {name:'Riya Family',initials:'RF',relation:'Family member',role:'Member',tone:'peach',activity:'Profile & care overview'},
    {name:'Sam Family',initials:'SF',relation:'Caregiver',role:'Caregiver',tone:'blue',activity:'Appointments & routines'},
    {name:'Priya Family',initials:'PF',relation:'Caregiver',role:'Caregiver',tone:'violet',activity:'Family coordination'}
  ];
  const doses = [
    {id:1,name:'Vitamin D3',time:'8:00 AM',member:'Alex',status:'taken'},
    {id:2,name:'Daily multivitamin',time:'1:00 PM',member:'Alex',status:'pending'},
    {id:3,name:'Calcium supplement',time:'8:00 PM',member:'Riya',status:'pending'}
  ];
  const notifications = [
    {id:1,title:'Appointment coming up',body:'Dr. Meera Shah · Wednesday, 11 November at 10:30 AM.',time:'Today · 9:00 AM',type:'appointment',read:false},
    {id:2,title:'Medication refill reminder',body:'Vitamin D3 sample supply estimate: 5 days remaining.',time:'Today · 8:30 AM',type:'medication',read:false},
    {id:3,title:'Family activity update',body:'Priya reviewed the sample appointment schedule.',time:'Yesterday · 4:40 PM',type:'family',read:true}
  ];
  let selectedDay = null;
  let monthOffset = 0;
  const date = new Date(2026,10,9);
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function openView(name){
    document.querySelectorAll('.demo-view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));
    document.querySelectorAll('.demo-nav-link').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    const label = ({overview:'Overview',analytics:'Health analytics',appointments:'Appointments',medications:'Medications',family:'Family & caregivers',notifications:'Notifications',settings:'Account settings'})[name]||'Overview';
    $('breadcrumbTitle').textContent=label;
    $('demoSidebar').classList.remove('open');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function lineChart(valuesA,valuesB,labels,opts={}){
    const w=700,h=opts.height||190,p={l:36,r:12,t:12,b:27},min=opts.min||0,max=opts.max||160;
    const x=i=>p.l+i*(w-p.l-p.r)/(valuesA.length-1),y=v=>p.t+(max-v)*(h-p.t-p.b)/(max-min);
    const grid=[0,1,2,3].map(i=>{const val=min+(max-min)*i/3,yy=y(val);return '<line x1="'+p.l+'" y1="'+yy+'" x2="'+(w-p.r)+'" y2="'+yy+'" stroke="#edf2ed" stroke-dasharray="3 4"/><text x="'+(p.l-8)+'" y="'+(yy+3)+'" fill="#a0aba3" font-size="10" text-anchor="end">'+Math.round(val)+'</text>';}).join('');
    const line=(vals,color)=>'<polyline fill="none" stroke="'+color+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="'+vals.map((v,i)=>x(i)+','+y(v)).join(' ')+'"/>'+vals.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3.5" fill="#fff" stroke="'+color+'" stroke-width="2"/>').join('');
    const xlabels=labels.map((l,i)=>'<text x="'+x(i)+'" y="'+(h-6)+'" fill="#9aa69e" font-size="10" text-anchor="middle">'+l+'</text>').join('');
    return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(opts.label||'Illustrative sample health measurement chart')+'">'+grid+(valuesB?line(valuesB,'#e0a56b'):'')+line(valuesA,'#4d9b83')+xlabels+'</svg>';
  }
  const days=['Tue','Wed','Thu','Fri','Sat','Sun','Mon'];
  const bp=[124,121,119,122,117,120,118],dia=[80,78,77,79,75,77,76],hr=[76,74,73,75,71,74,72];
  $('overviewChart').innerHTML=lineChart(bp,hr,days,{min:50,max:140,height:175,label:'Sample systolic blood pressure and heart rate trends'});
  $('bpChart').innerHTML=lineChart(bp,dia,days,{min:50,max:140,height:225,label:'Sample systolic and diastolic blood pressure trends'});
  $('hrChart').innerHTML=lineChart(hr,null,days,{min:55,max:90,height:225,label:'Sample heart rate trend'});
  function updateAdherence(){
    const taken=doses.filter(d=>d.status==='taken').length;
    const missed=doses.filter(d=>d.status==='missed').length;
    const takenTotal=46+taken-1,missedTotal=4+missed;const pct=Math.round((takenTotal/(takenTotal+missedTotal))*100);
    ['overviewAdherence','analyticsAdherence'].forEach(id=>{if($(id))$(id).innerHTML=pct+'<span>%</span>';});
    $('analyticsScore').textContent=pct+'%';$('adherenceBar').style.width=pct+'%';
    $('takenCount').textContent=45+taken;$('missedCount').textContent=4+missed;
    $('todayDoseCount').textContent=doses.length;
  }
  function doseRow(d,compact=false){
    return '<div class="compact-row"><span class="compact-icon">✚</span><span><strong>'+esc(d.name)+'</strong><small>'+esc(d.member)+' · '+esc(d.time)+'</small></span><em>'+esc(d.status==='taken'?'Taken':d.status==='missed'?'Missed':'Upcoming')+'</em></div>';
  }
  function renderDoses(){
    $('overviewDoseList').innerHTML=doses.map(doseRow).join('');
    $('doseHistory').innerHTML=doses.map(doseRow).join('');
    $('medicationCards').innerHTML=medications.map(m=>'<article class="medication-card"><div class="medication-card-top"><span class="medication-symbol">✚</span><span class="status-pill">Active</span></div><h3>'+esc(m.name)+'</h3><p>'+esc(m.member)+' · '+esc(m.dose)+'</p><p>'+esc(m.time)+' · '+esc(m.refill)+'</p><p class="medication-instruction">'+esc(m.instruction)+'</p><div class="medication-actions"><button class="dose-action taken" data-dose="'+m.id+'" data-status="taken">Mark taken</button><button class="dose-action" data-dose="'+m.id+'" data-status="missed">Mark missed</button></div></article>').join('');
    document.querySelectorAll('[data-dose]').forEach(btn=>{
      const d=doses.find(x=>x.id===Number(btn.dataset.dose));
      if(d&&d.status!=='pending'){btn.disabled=true;return;}
      btn.addEventListener('click',()=>{
        const dose=doses.find(x=>x.id===Number(btn.dataset.dose));
        if(!dose||dose.status!=='pending') return;
        dose.status=btn.dataset.status;
        renderDoses();
      });
    });
    updateAdherence();
  }
  function renderCalendar(){
    const current=new Date(2026,10+monthOffset,1),year=current.getFullYear(),month=current.getMonth(),first=current.getDay(),count=new Date(year,month+1,0).getDate();
    const visits=appointments.filter(a=>a.month===month);
    $('selectedDateTitle').textContent=selectedDay===null?'All upcoming visits':months[month]+' '+selectedDay;
    $('calendarGrid').innerHTML=weekdays.map(d=>'<div class="calendar-cell weekday">'+d+'</div>').join('')+Array.from({length:first},()=>'<div class="calendar-cell" aria-hidden="true"></div>').join('')+Array.from({length:count},(_,i)=>{const day=i+1,has=visits.some(a=>a.day===day);return '<button class="calendar-cell '+(has?'has-visit ':'')+(selectedDay===day?'selected':'')+'" data-day="'+day+'">'+day+'</button>';}).join('');
    $('calendarGrid').querySelectorAll('[data-day]').forEach(btn=>btn.addEventListener('click',()=>{selectedDay=Number(btn.dataset.day);renderCalendar();renderAppointments();}));
    $('appointmentList').innerHTML='';
    renderAppointments();
    $('calendarTitle');
    document.querySelector('#view-appointments .surface-heading h2').textContent=months[month]+' '+year;
  }
  function renderAppointments(){
    const filter=$('appointmentFilter').value;
    const month=new Date(2026,10+monthOffset,1).getMonth();
    const rows=appointments.filter(a=>a.month===month&&(!selectedDay||a.day===selectedDay)&&(filter==='all'||a.status===filter));
    $('appointmentList').innerHTML=rows.length?rows.map(a=>'<div class="visit-row"><div class="visit-date"><strong>'+a.day+'</strong><small>'+months[a.month].slice(0,3).toUpperCase()+'</small></div><div class="visit-info"><strong>'+esc(a.title)+'</strong><small>'+esc(a.doctor)+' · '+esc(a.time)+'<br>'+esc(a.member)+' · '+esc(a.clinic)+'</small></div><span class="status-pill '+esc(a.status)+'">'+esc(a.status)+'</span></div>').join(''):'<p class="empty-state">No sample visits for this date and filter.</p>';
  }
  function renderFamily(){
    $('familyCards').innerHTML=family.map(f=>'<article class="family-card"><span class="avatar avatar-'+f.tone+'">'+f.initials+'</span><h3>'+esc(f.name)+'</h3><p>'+esc(f.relation)+'</p><span class="family-role">'+esc(f.role)+'</span><small>'+esc(f.activity)+'</small></article>').join('');
  }
  function renderNotifications(){
    $('notificationList').innerHTML=notifications.map(n=>'<div class="notification-row '+(!n.read?'unread':'')+'"><span class="notification-symbol">'+(n.type==='appointment'?'▦':n.type==='medication'?'✚':'♧')+'</span><div class="notification-copy"><strong>'+esc(n.title)+'</strong><small>'+esc(n.time)+'</small><p>'+esc(n.body)+'</p></div>'+(n.read?'':'<button data-read="'+n.id+'">Mark read</button>')+'</div>').join('');
    document.querySelectorAll('[data-read]').forEach(btn=>btn.addEventListener('click',()=>{const n=notifications.find(x=>x.id===Number(btn.dataset.read));if(n)n.read=true;renderNotifications();updateUnread();}));
    updateUnread();
  }
  function updateUnread(){
    const count=notifications.filter(n=>!n.read).length;
    document.querySelectorAll('.unread-count').forEach(el=>el.textContent=count);
    document.querySelectorAll('.notification-dot').forEach(el=>el.style.display=count?'block':'none');
  }
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>openView(btn.dataset.view)));
  document.querySelectorAll('[data-open-view]').forEach(btn=>btn.addEventListener('click',()=>openView(btn.dataset.openView)));
  $('mobileToggle').addEventListener('click',()=>$('demoSidebar').classList.toggle('open'));
  $('calendarPrev').addEventListener('click',()=>{monthOffset--;selectedDay=null;renderCalendar();});
  $('calendarNext').addEventListener('click',()=>{monthOffset++;selectedDay=null;renderCalendar();});
  $('appointmentFilter').addEventListener('change',renderAppointments);
  $('addAppointmentButton').addEventListener('click',()=>{appointments.push({id:Date.now(),day:24,month:10,title:'New sample visit',doctor:'Sample clinician',specialty:'General care',clinic:'Demo clinic',time:'2:00 PM',status:'scheduled',member:'Alex'});selectedDay=24;monthOffset=0;renderCalendar();});
  $('markAllRead').addEventListener('click',()=>{notifications.forEach(n=>n.read=true);renderNotifications();});
  $('resetDemo').addEventListener('click',()=>{doses.forEach((d,i)=>d.status=i===0?'taken':'pending');notifications.forEach((n,i)=>n.read=i===2);monthOffset=0;selectedDay=null;renderDoses();renderCalendar();renderNotifications();updateUnread();document.querySelectorAll('[data-setting]').forEach(input=>{input.checked=input.dataset.setting!=='family';});});
  document.querySelectorAll('[data-setting]').forEach(input=>input.addEventListener('change',()=>{const title=input.closest('label').querySelector('strong').textContent;const note=document.createElement('p');note.className='settings-footnote';note.textContent=title+' preference updated for this demo session.';input.closest('label').after(note);setTimeout(()=>note.remove(),2200);}));

  const quickDialog=$('quickAddDialog'),quickFields=$('quickAddFields'),quickForm=$('quickAddForm');
  let quickKind='';
  const familyNames=()=>family.map(f=>f.name.replace(' Family',''));
  function field(label,name,type='text',value='',options=null,full=false,required=true){
    const input=options?'<select name="'+name+'" '+(required?'required':'')+'>'+options.map(o=>'<option value="'+esc(o.value)+'" '+(o.value===value?'selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select>':'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required':'')+'>';
    return '<div class="quick-field '+(full?'full':'')+'"><label for="quick-'+name+'">'+esc(label)+'</label>'+input.replace('name="'+name+'"','id="quick-'+name+'" name="'+name+'"')+'</div>';
  }
  function openQuickAdd(kind){
    quickKind=kind;
    const configs={
      appointment:{title:'Schedule an appointment',desc:'Add the visit details once. You can review it in your calendar.',fields:
        field('Appointment title','title','text','Routine follow-up',null,true)+
        field('Family member','member','text','Alex')+
        field('Doctor / provider','doctor','text','Dr. Meera Shah')+
        field('Clinic / location','clinic','text','Sample City Clinic')+
        field('Date','date','date','2026-11-20')+
        field('Time','time','time','10:30')+
        field('Repeat','repeat','text','Does not repeat',null,true,false)+
        field('Notes (optional)','notes','text','',null,true,false)},
      medication:{title:'Add a medication',desc:'Create a simple daily schedule for this sample profile.',fields:
        field('Medication name','name','text','',null,true)+
        field('Family member','member','text','Alex')+
        field('Dosage','dose','text','1 tablet')+
        field('Schedule time','time','time','08:00')+
        field('Frequency','frequency','text','Every day')+
        field('Start date','start','date','2026-11-09')+
        field('Refill after (days)','refill','number','30')+
        field('Instructions (optional)','instruction','text','',null,true,false)},
      measurement:{title:'Log a health reading',desc:'Record a sample measurement. This demo does not interpret readings.',fields:
        field('Measurement','metric','text','Blood pressure')+
        field('Family member','member','text','Alex')+
        field('Value','value','text','120/80')+
        field('Unit','unit','text','mmHg')+
        field('Date','date','date','2026-11-09')+
        field('Time','time','time','09:00')+
        field('Note (optional)','notes','text','',null,true,false)},
      family:{title:'Add a family member',desc:'Add a fictional profile to the sample care circle.',fields:
        field('Full name','name','text','',null,true)+
        field('Relationship','relation','text','Family member')+
        field('Role','role','text','Member')+
        field('Initials','initials','text','',null,false,false)}
    };
    const config=configs[kind];if(!config)return;
    $('quickAddTitle').textContent=config.title;$('quickAddDescription').textContent=config.desc;quickFields.innerHTML=config.fields;
    if(typeof quickDialog.showModal==='function')quickDialog.showModal();else quickDialog.setAttribute('open','');
    const first=quickFields.querySelector('input,select');if(first)first.focus();
  }
  function closeQuickAdd(){if(quickDialog.open)quickDialog.close();else quickDialog.removeAttribute('open');}
  function notifySaved(message){
    document.querySelector('.quick-add-toast')?.remove();
    const toast=document.createElement('div');toast.className='quick-add-toast';toast.setAttribute('role','status');toast.textContent=message;document.body.append(toast);window.setTimeout(()=>toast.remove(),2600);
  }
  document.querySelectorAll('[data-quick-add]').forEach(btn=>btn.addEventListener('click',()=>openQuickAdd(btn.dataset.quickAdd)));
  $('closeQuickAdd').addEventListener('click',closeQuickAdd);$('cancelQuickAdd').addEventListener('click',closeQuickAdd);
  quickDialog.addEventListener('click',e=>{if(e.target===quickDialog)closeQuickAdd();});
  quickForm.addEventListener('submit',e=>{
    e.preventDefault();const data=Object.fromEntries(new FormData(quickForm).entries());
    if(quickKind==='appointment'){
      const dt=new Date(data.date+'T12:00:00');if(Number.isNaN(dt.getTime()))return;
      appointments.push({id:Date.now(),day:dt.getDate(),month:dt.getMonth(),title:data.title,doctor:data.doctor,specialty:'Sample provider',clinic:data.clinic,time:new Date('1970-01-01T'+data.time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),status:'scheduled',member:data.member});
      monthOffset=(dt.getFullYear()-2026)*12+dt.getMonth()-10;selectedDay=dt.getDate();renderCalendar();openView('appointments');notifySaved('Appointment added to the sample calendar.');
    }else if(quickKind==='medication'){
      const med={id:Date.now(),name:data.name,dose:data.dose,time:new Date('1970-01-01T'+data.time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),instruction:data.instruction||'No extra instructions',member:data.member,refill:(Number(data.refill)>0?Number(data.refill):30)+' days refill estimate',status:'active'};
      medications.push(med);doses.push({id:med.id,name:med.name,time:med.time,member:med.member,status:'pending'});renderDoses();openView('medications');notifySaved('Medication and daily check-in schedule added.');
    }else if(quickKind==='measurement'){
      const row=document.createElement('div');row.className='activity-item';row.innerHTML='<span class="activity-icon mint">⌁</span><div><strong>'+esc(data.metric)+': '+esc(data.value)+' '+esc(data.unit)+'</strong><small>'+esc(data.member)+' · '+esc(data.date)+' '+esc(data.time)+'</small></div><span class="activity-tag">Measurement</span>';
      document.querySelector('#view-family .activity-list')?.prepend(row);openView('analytics');notifySaved('Sample health reading added to the activity feed.');
    }else if(quickKind==='family'){
      const name=data.name.trim();const initials=(data.initials.trim()||name.split(/\s+/).map(x=>x[0]).join('').slice(0,2)).toUpperCase();
      family.push({name,initials,relation:data.relation,role:data.role,tone:'teal',activity:'New sample profile'});renderFamily();openView('family');notifySaved('Family member added to the sample care circle.');
    }
    closeQuickAdd();quickForm.reset();
  });

  renderDoses();renderCalendar();renderFamily();renderNotifications();updateUnread();
  $('analyticsAdherence').textContent='92%';
})();