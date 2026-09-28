$ErrorActionPreference = 'Stop'
$repo='bayaya-devi/A-B-TECHNOLOGIES';$path='crm.js'
$item=(gh api "repos/$repo/contents/$path")|ConvertFrom-Json
$text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($item.content -replace '\s','')))
$text=$text.Replace("rows=data||[];fillFilters();renderMetrics();renderList();if(selected){","rows=data||[];fillFilters();renderMetrics();renderList();const linkedReference=new URLSearchParams(location.search).get('reference');if(!selected&&linkedReference){const linked=rows.find(r=>r.reference===linkedReference);if(linked)return show(linked)}if(selected){")
$text=$text.Replace("async function show(r){selected=r;renderList();","async function show(r){selected=r;history.replaceState(null,'',location.pathname+'?reference='+encodeURIComponent(r.reference));renderList();")
$old="function renderTab(){const p=`$('#tabPanel'),r=current.r,a=r.answers||{};"
$new=@'
function appointmentCards(){if(!current.appointments.length)return '<div class="empty">Aucun rendez-vous.</div>';return current.appointments.map(a=>`<div class="document"><div><b>${esc(a.mode||'Rendez-vous')} · ${a.duration_minutes||30} min</b><small class="muted">${esc(a.status)} · ${a.appointment_slots.map(s=>fmt(s.starts_at)).join(' / ')}</small></div><div>${a.status==='proposed'?a.appointment_slots.map(s=>`<button class="secondary" data-confirm-slot="${s.id}" data-appointment="${a.id}" data-start="${s.starts_at}">Confirmer ${fmt(s.starts_at)}</button>`).join(' '):''}</div></div>`).join('')}
function renderTab(){const p=$('#tabPanel'),r=current.r,a=r.answers||{};
'@
$text=$text.Replace($old,$new.TrimEnd("`r","`n"))
$old='${info(''Statut'',statusLabels[r.status]||r.status)}</div>`;'
$new='${info(''Statut'',statusLabels[r.status]||r.status)}</div><h3>Rendez-vous</h3>${appointmentCards()}`;document.querySelectorAll(''[data-confirm-slot]'').forEach(b=>b.onclick=()=>confirmAppointment(b.dataset.appointment,b.dataset.confirmSlot,b.dataset.start));'
$text=$text.Replace($old,$new)
$old='async function markQuote(id,status){'
$new=@'
async function confirmAppointment(appointmentId,slotId,startsAt){if(!confirm('Confirmer ce créneau de rendez-vous ?'))return;const now=new Date().toISOString();const a=await s.from('appointments').update({status:'confirmed',confirmed_slot:startsAt,starts_at:startsAt}).eq('id',appointmentId);if(a.error)return setError(a.error.message);await s.from('appointment_slots').update({status:'declined'}).eq('appointment_id',appointmentId);await s.from('appointment_slots').update({status:'confirmed'}).eq('id',slotId);await s.from('project_requests').update({status:'rdv_programme'}).eq('id',current.r.id);await s.from('crm_activity').insert({project_request_id:current.r.id,lead_id:current.r.lead_id,actor_id:currentUser.id,event_type:'appointment_confirmed',title:'Rendez-vous confirmé',details:{appointment_id:appointmentId,starts_at:startsAt,confirmed_at:now}});await show(current.r)}
async function markQuote(id,status){
'@
$text=$text.Replace($old,$new.TrimEnd("`r","`n"))
$body=@{message='feat: open linked CRM records and confirm appointments';content=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text));sha=$item.sha;branch='main'}|ConvertTo-Json -Compress
$body|gh api "repos/$repo/contents/$path" --method PUT --input -|Out-Null
