$ErrorActionPreference='Stop';$repo='bayaya-devi/A-B-TECHNOLOGIES';$path='crm.js'
$item=(gh api "repos/$repo/contents/$path")|ConvertFrom-Json
$text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($item.content -replace '\s','')))
$cards=@'
function appointmentCards(){if(!current.appointments.length)return '<div class="empty">Aucun rendez-vous.</div>';return current.appointments.map(a=>`<div class="document"><div><b>${esc(a.mode||'Rendez-vous')} - ${a.duration_minutes||30} min</b><small class="muted">${esc(a.status)} - ${a.appointment_slots.map(s=>fmt(s.starts_at)).join(' / ')}</small></div><div>${a.status==='proposed'?a.appointment_slots.map(s=>`<button class="secondary" data-confirm-slot="${s.id}" data-appointment="${a.id}" data-start="${s.starts_at}">Confirmer ${fmt(s.starts_at)}</button>`).join(' '):''}</div></div>`).join('')}
function renderTab
'@
$text=[regex]::Replace($text,'function appointmentCards\(\)\{.*?\}\r?\nfunction renderTab',$cards.TrimEnd("`r","`n"),[Text.RegularExpressions.RegexOptions]::Singleline)
$text=$text.Replace('confirm(''Confirmer ce crÃ©neau de rendez-vous ?'')','confirm(''Confirmer ce creneau de rendez-vous ?'')').Replace('title:''Rendez-vous confirmÃ©''','title:''Rendez-vous confirme''')
$body=@{message='fix: normalize CRM appointment labels';content=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text));sha=$item.sha;branch='main'}|ConvertTo-Json -Compress
$body|gh api "repos/$repo/contents/$path" --method PUT --input -|Out-Null
