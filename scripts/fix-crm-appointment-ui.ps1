$ErrorActionPreference='Stop';$repo='bayaya-devi/A-B-TECHNOLOGIES';$path='crm.js'
$item=(gh api "repos/$repo/contents/$path")|ConvertFrom-Json
$text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($item.content -replace '\s','')))
$text=$text.Replace("if(activeTab==='identity')p.innerHTML=","if(activeTab==='identity'){p.innerHTML=")
$text=$text.Replace("b.dataset.confirmSlot,b.dataset.start));`nelse if(activeTab==='configurator')","b.dataset.confirmSlot,b.dataset.start));}`nelse if(activeTab==='configurator')")
$text=$text.Replace('Â·',' - ').Replace('crÃ©neau','creneau').Replace('confirmÃ©','confirme')
$body=@{message='fix: render CRM appointment controls safely';content=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text));sha=$item.sha;branch='main'}|ConvertTo-Json -Compress
$body|gh api "repos/$repo/contents/$path" --method PUT --input -|Out-Null
