$ErrorActionPreference='Stop';$repo='bayaya-devi/A-B-TECHNOLOGIES';$path='crm.js'
$item=(gh api "repos/$repo/contents/$path")|ConvertFrom-Json
$text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($item.content -replace '\s','')))
$replacement=@'
async function confirmAppointment(appointmentId,slotId,startsAt){if(!confirm('Confirmer ce creneau de rendez-vous ?'))return;const now=new Date().toISOString();const a=await s.from('appointments').update({status:'confirmed',confirmed_slot:startsAt,starts_at:startsAt}).eq('id',appointmentId);if(a.error)return setError(a.error.message);await s.from('appointment_slots').update({status:'declined'}).eq('appointment_id',appointmentId);await s.from('appointment_slots').update({status:'confirmed'}).eq('id',slotId);await s.from('project_requests').update({status:'rdv_programme'}).eq('id',current.r.id);await s.from('crm_activity').insert({project_request_id:current.r.id,lead_id:current.r.lead_id,actor_id:currentUser.id,event_type:'appointment_confirmed',title:'Rendez-vous confirme',details:{appointment_id:appointmentId,starts_at:startsAt,confirmed_at:now}});await show(current.r)}
async function markQuote
'@
$text=[regex]::Replace($text,'async function confirmAppointment\(.*?\}\r?\nasync function markQuote',$replacement.TrimEnd("`r","`n"),[Text.RegularExpressions.RegexOptions]::Singleline)
$body=@{message='fix: normalize appointment confirmation text';content=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text));sha=$item.sha;branch='main'}|ConvertTo-Json -Compress
$body|gh api "repos/$repo/contents/$path" --method PUT --input -|Out-Null
