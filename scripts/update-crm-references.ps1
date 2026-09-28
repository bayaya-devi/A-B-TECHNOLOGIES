$ErrorActionPreference = 'Stop'
$repo = 'bayaya-devi/A-B-TECHNOLOGIES'

function Update-RepoText([string]$Path, [scriptblock]$Transform, [string]$Message) {
  $item = (gh api "repos/$repo/contents/$Path") | ConvertFrom-Json
  $current = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($item.content -replace '\s','')))
  $updated = & $Transform $current
  if ($updated -eq $current) { Write-Output "Unchanged: $Path"; return }
  $body = @{
    message = $Message
    content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($updated))
    sha = $item.sha
    branch = 'main'
  } | ConvertTo-Json -Compress
  $body | gh api "repos/$repo/contents/$Path" --method PUT --input - | Out-Null
  Write-Output "Updated: $Path"
}

Update-RepoText 'supabase/functions/notify-new-request/index.ts' {
  param($text) $text.Replace('/A-B-TECHNOLOGIES/admin.html', '/A-B-TECHNOLOGIES/portal-ab-gestion-k9m4x.html')
} 'fix: link notifications to the CRM portal'

Update-RepoText 'admin-password.js' {
  param($text) $text.Replace("'admin.html'", "'portal-ab-gestion-k9m4x.html'")
} 'fix: keep password flow on the CRM portal'

Update-RepoText 'supabase/config.toml' {
  param($text) $text.Replace('https://bayaya-devi.github.io/A-B-TECHNOLOGIES/admin.html', 'https://bayaya-devi.github.io/A-B-TECHNOLOGIES/portal-ab-gestion-k9m4x.html')
} 'fix: authorize the CRM authentication redirect'

Update-RepoText 'scripts/test-supabase-e2e.mjs' {
  param($text) $text.Replace('/A-B-TECHNOLOGIES/admin.html', '/A-B-TECHNOLOGIES/portal-ab-gestion-k9m4x.html').Replace('admin.html', 'portail CRM')
} 'test: target the private CRM portal'

Update-RepoText 'supabase/functions/send-client-email/index.ts' {
  param($text)
  $needle = "      if (!validUuid(input.idempotencyKey)) return response(origin, { error: 'Clé d’envoi invalide' }, 400);`n"
  $addition = @"

      const { data: duplicate } = await admin.from('communications').select('*')
        .eq('idempotency_key', input.idempotencyKey).maybeSingle();
      if (duplicate?.status === 'sent') return response(origin, { communication: duplicate, idempotent: true });
      if (duplicate) return response(origin, { error: 'Envoi déjà en cours ou enregistré' }, 409);
"@
  if ($text.Contains('const { data: duplicate }')) { return $text }
  return $text.Replace($needle, $needle + $addition)
} 'fix: claim CRM email idempotency before side effects'
