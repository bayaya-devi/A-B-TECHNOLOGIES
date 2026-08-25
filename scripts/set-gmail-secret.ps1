Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'A&B Technologies - Gmail'
$form.Size = New-Object System.Drawing.Size(470, 205)
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false

$label = New-Object System.Windows.Forms.Label
$label.Text = "Collez le mot de passe d'application Google (16 caractères) :"
$label.Location = New-Object System.Drawing.Point(20, 20)
$label.Size = New-Object System.Drawing.Size(420, 25)
$form.Controls.Add($label)

$input = New-Object System.Windows.Forms.TextBox
$input.Location = New-Object System.Drawing.Point(20, 55)
$input.Size = New-Object System.Drawing.Size(415, 28)
$input.UseSystemPasswordChar = $true
$form.Controls.Add($input)

$button = New-Object System.Windows.Forms.Button
$button.Text = 'Enregistrer dans Supabase'
$button.Location = New-Object System.Drawing.Point(225, 100)
$button.Size = New-Object System.Drawing.Size(210, 36)
$button.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.AcceptButton = $button
$form.Controls.Add($button)

$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = 'Annuler'
$cancel.Location = New-Object System.Drawing.Point(110, 100)
$cancel.Size = New-Object System.Drawing.Size(100, 36)
$cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.CancelButton = $cancel
$form.Controls.Add($cancel)

$input.Select()
$result = $form.ShowDialog()
if ($result -ne [System.Windows.Forms.DialogResult]::OK) { exit 2 }

$password = ($input.Text -replace '[\s-]', '').Trim()
$input.Text = ''
if ($password -notmatch '^[A-Za-z0-9]{16}$') {
  [System.Windows.Forms.MessageBox]::Show('Le code doit contenir exactement 16 caractères.', 'Code invalide', 'OK', 'Error') | Out-Null
  exit 3
}

$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempFile = Join-Path $tempRoot ("ab-gmail-secret-{0}.env" -f [guid]::NewGuid())
try {
  [IO.File]::WriteAllText($tempFile, "GMAIL_APP_PASSWORD=$password`nEMAIL_PROVIDER=gmail-smtp`n", (New-Object Text.UTF8Encoding($false)))
  $password = $null
  & npx.cmd --yes supabase@latest secrets set --env-file $tempFile --project-ref elusxpsvgimtavlypjlp --agent no --output-format text
  if ($LASTEXITCODE -ne 0) { throw 'Supabase CLI a refusé le secret.' }
  [System.Windows.Forms.MessageBox]::Show('Secret Gmail enregistré dans Supabase.', 'A&B Technologies', 'OK', 'Information') | Out-Null
} catch {
  [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Échec', 'OK', 'Error') | Out-Null
  exit 4
} finally {
  $resolvedTemp = [IO.Path]::GetFullPath($tempFile)
  if ($resolvedTemp.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedTemp)) {
    Remove-Item -LiteralPath $resolvedTemp -Force
  }
}
