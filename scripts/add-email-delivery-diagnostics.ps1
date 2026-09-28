$ErrorActionPreference='Stop';$repo='bayaya-devi/A-B-TECHNOLOGIES';$path='supabase/functions/send-client-email/index.ts'
$item=(gh api "repos/$repo/contents/$path")|ConvertFrom-Json
$text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($item.content -replace '\s','')))
$old="return response(origin, { communication: sent, provider: 'gmail-smtp' });"
$new="return response(origin, { communication: sent, provider: 'gmail-smtp', sender: ``A&B Technologies <`${ADMIN_EMAIL}>``, replyTo: ADMIN_EMAIL, accepted: mail.accepted || [], rejected: mail.rejected || [] });"
if(-not $text.Contains($old)){throw 'Return statement not found'}
$text=$text.Replace($old,$new)
$body=@{message='test: expose safe Gmail delivery diagnostics';content=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text));sha=$item.sha;branch='main'}|ConvertTo-Json -Compress
$body|gh api "repos/$repo/contents/$path" --method PUT --input -|Out-Null
