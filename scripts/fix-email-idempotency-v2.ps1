$ErrorActionPreference = 'Stop'
$repo = 'bayaya-devi/A-B-TECHNOLOGIES'
$path = 'supabase/functions/send-client-email/index.ts'
$item = (gh api "repos/$repo/contents/$path") | ConvertFrom-Json
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($item.content -replace '\s','')))
if (-not $text.Contains('duplicate?.status')) {
  $needle = "      if (input.type === 'appointment_proposal') {"
  $addition = "      const { data: duplicate } = await admin.from('communications').select('*')`n        .eq('idempotency_key', input.idempotencyKey).maybeSingle();`n      if (duplicate?.status === 'sent') return response(origin, { communication: duplicate, idempotent: true });`n      if (duplicate) return response(origin, { error: 'Duplicate request already recorded' }, 409);`n`n"
  if (-not $text.Contains($needle)) { throw 'Insertion point not found' }
  $text = $text.Replace($needle, $addition + $needle)
  $body = @{ message='fix: claim CRM email idempotency before side effects'; content=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text)); sha=$item.sha; branch='main' } | ConvertTo-Json -Compress
  $body | gh api "repos/$repo/contents/$path" --method PUT --input - | Out-Null
}
