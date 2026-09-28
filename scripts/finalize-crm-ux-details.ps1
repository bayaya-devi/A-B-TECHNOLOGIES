$ErrorActionPreference='Stop';$repo='bayaya-devi/A-B-TECHNOLOGIES';$path='crm.js'
$item=(gh api "repos/$repo/contents/$path")|ConvertFrom-Json
$text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($item.content -replace '\s','')))
$text=[regex]::Replace($text,"\['exchanges','[^']+'\]","['exchanges','Echanges ('+current.communications.length+')']")
$timeline=@'
${e.type?' - '+esc(e.type):''}${e.recipient?' - vers '+esc(e.recipient):''}</small>
'@
$text=[regex]::Replace($text,'\$\{e\.type\?.*?</small>',$timeline.TrimEnd("`r","`n"),[Text.RegularExpressions.RegexOptions]::Singleline)
$quote=@'
items.push({name:q.filename,url:x.data?.signedUrl,type:`Devis ${q.reference} - ${money(q)} - ${q.status}${q.validity_date?' - valide jusqu au '+new Date(q.validity_date).toLocaleDateString('fr-FR'):''}`,quote:q})
'@
$text=[regex]::Replace($text,'items\.push\(\{name:q\.filename,url:x\.data\?\.signedUrl,type:`Devis \$\{q\.reference\}.*?,quote:q\}\)',$quote.TrimEnd("`r","`n"))
$body=@{message='ux: clarify quotes and email history';content=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text));sha=$item.sha;branch='main'}|ConvertTo-Json -Compress
$body|gh api "repos/$repo/contents/$path" --method PUT --input -|Out-Null
