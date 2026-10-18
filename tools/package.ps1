# Keeps the deliverable zip in sync with the project tree.
#
# NOTE: this file is intentionally pure ASCII. Windows PowerShell 5.1 reads
# a BOM-less .ps1 using the system ANSI code page, so any non-ASCII byte in a
# path literal (or even in a comment) can be mangled into a character that
# breaks parsing. All paths are derived from the script's own location.
param([string]$Destination = '')
$ErrorActionPreference = 'Stop'
# ZipArchive/ZipArchiveMode live in System.IO.Compression;
# ZipFile helpers live in System.IO.Compression.FileSystem.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$root = Split-Path $here -Parent
$zip  = if ($Destination) { [IO.Path]::GetFullPath($Destination) } else { Join-Path (Split-Path $root -Parent) 'black-forest-prototype-v4.zip' }
$top  = 'dark-forest'

if (-not (Test-Path $root)) { throw "project root not found: $root" }
if (Test-Path $zip) { throw "target already exists: $zip" }

$files = New-Object System.Collections.Generic.List[string]
function Add-Rel([string]$rel) {
  $full = Join-Path $root $rel
  if (Test-Path $full) { $files.Add($full) }
}

# entry point + docs
Add-Rel 'index.html'
Add-Rel 'README.md'
Add-Rel 'assets/hand-reader.css'
Add-Rel 'release.json'
Get-ChildItem (Join-Path $root 'docs\gameplay') -File | Where-Object { $_.Extension -in '.md','.json' } | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'docs\optimization') -File | Where-Object { $_.Extension -in '.md','.json','.txt' } | ForEach-Object { $files.Add($_.FullName) }

# all game source
Get-ChildItem (Join-Path $root 'src') -Recurse -File -Filter *.js | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'locales') -Recurse -File -Filter *.js | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'assets\fonts') -File | ForEach-Object { $files.Add($_.FullName) }

# runtime assets only: wired-up card art + webp + enemy png + phaser build.
# Unregistered .jpg sources and .tmp-gen/ intermediates are deliberately excluded.
#
# Card art is NOT globbed. Only the entries registered in CARD_ART (src/core/ui.js)
# are shipped, because BootScene.preload loads that list and nothing else.
# Globbing art-gothic-*.png would drag ~5 MB of finished-but-unreferenced
# illustrations into the deliverable for no runtime benefit.
# Read with an explicit UTF8 encoding: Get-Content -Raw would decode this BOM-less
# file through the ANSI code page and could mangle a byte into a quote character.
$uiPath = Join-Path $root 'src\core\ui.js'
$ui = [IO.File]::ReadAllText($uiPath, [Text.Encoding]::UTF8)
$artList = [regex]::Match($ui, 'const\s+CARD_ART\s*=\s*\[([^\]]*)\]')
if (-not $artList.Success) { throw "could not locate the CARD_ART array in src/core/ui.js" }
$formatsMatch = [regex]::Match($ui, 'const\s+CARD_ART_FORMATS\s*=\s*(\{[\s\S]*?\});')
if (-not $formatsMatch.Success) { throw 'could not locate CARD_ART_FORMATS' }
$formats = $formatsMatch.Groups[1].Value | ConvertFrom-Json
$wired = [regex]::Matches($artList.Groups[1].Value, '[''"]([a-z]+)/([a-z_]+)[''"]') |
  ForEach-Object {
    $id = $_.Groups[1].Value + '/' + $_.Groups[2].Value
    $ext = if ($formats.PSObject.Properties[$id]) { $formats.PSObject.Properties[$id].Value } else { 'png' }
    'art-' + $_.Groups[1].Value + '-' + $_.Groups[2].Value + '.' + $ext
  }
if ($wired.Count -eq 0) { throw "CARD_ART is empty; refusing to guess which art is wired" }
foreach ($n in ($wired | Sort-Object -Unique)) { Add-Rel (Join-Path 'assets' $n) }
$backsMatch = [regex]::Match($ui, 'const\s+CARD_BACK_ART\s*=\s*(\{[\s\S]*?\});')
if ($backsMatch.Success) {
  $backs = $backsMatch.Groups[1].Value | ConvertFrom-Json
  foreach ($entry in $backs.PSObject.Properties) { Add-Rel (Join-Path 'assets' $entry.Value) }
}
Get-ChildItem (Join-Path $root 'assets') -File -Filter *.webp              | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'assets') -File -Filter 'enemy-*.png'       | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'assets\vendor') -File                      | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'assets\anim') -File -Filter *.png           | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'assets\story') -File -Filter *.webp         | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'assets\audio') -File -Filter *.wav         | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'assets\audio') -File | Where-Object { $_.Extension -in '.ogg','.m4a' } | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'assets\optimized') -Recurse -File | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'docs\audio') -File | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'docs\ui-refresh') -File | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'docs\duel') -File | ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'docs\hero-fx') -File |
  Where-Object { $_.Name -notlike '*-reference.png' -and $_.Extension -in '.md','.json','.html','.png' } |
  ForEach-Object { $files.Add($_.FullName) }
Get-ChildItem (Join-Path $root 'docs\story') -File |
  Where-Object { $_.Extension -in '.md', '.html', '.json', '.png' } |
  ForEach-Object { $files.Add($_.FullName) }
# Narrative preview screenshots are top-level PNGs; source/ originals stay out.
# Generated UI production textures; source atlases remain in the project only.
Get-ChildItem (Join-Path $root 'assets\ui') -File |
  Where-Object { $_.Name -notlike '*-source-*' -and $_.Extension -in '.png', '.webp' } |
  ForEach-Object { $files.Add($_.FullName) }

# art handoff docs (markdown / html / json only, no source art, no screenshots)
Add-Rel 'docs\ART-BRIEF.md'
Add-Rel 'docs\layout-spec.html'
Add-Rel 'docs\research.md'
Add-Rel 'docs\art-polish\REPORT.md'
Add-Rel 'docs\art-polish\ASSETS.json'
Add-Rel 'docs\art-polish\RELIC-PROMPT.json'
Add-Rel 'docs\art-polish\TACTICAL-PROMPT.json'
Add-Rel 'docs\hero-ui\DESIGN-REPORT.md'
Add-Rel 'docs\hero-ui\ASSETS.json'
Add-Rel 'docs\hero-ui\HERO-PROMPT.json'
Add-Rel 'docs\hero-ui\AVATAR-PROMPT.json'
Get-ChildItem (Join-Path $root 'docs\art') -File |
  Where-Object { $_.Extension -in '.md', '.html', '.json' } |
  ForEach-Object { $files.Add($_.FullName) }

# toolchain (__pycache__ is a directory, so -File already skips it)
Get-ChildItem (Join-Path $root 'tools') -File | ForEach-Object { $files.Add($_.FullName) }

$files = @($files | Sort-Object -Unique)
$fs = [IO.File]::Open($zip, [IO.FileMode]::CreateNew)
try {
  $archive = New-Object IO.Compression.ZipArchive($fs, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($f in $files) {
      $rel = $f.Substring($root.Length + 1).Replace('\', '/')
      $entry = $archive.CreateEntry("$top/$rel", [IO.Compression.CompressionLevel]::Optimal)
      $es = $entry.Open()
      $bytes = [IO.File]::ReadAllBytes($f)
      $es.Write($bytes, 0, $bytes.Length)
      $es.Dispose()
    }
  } finally { $archive.Dispose() }
} finally { $fs.Dispose() }

$fi = Get-Item $zip
"zip   : $($fi.FullName)"
"files : $($files.Count)"
"size  : {0:N2} MB" -f ($fi.Length / 1MB)
