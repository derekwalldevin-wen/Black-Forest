param([string]$ArchivePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path $PSScriptRoot -Parent
$archive = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($ArchivePath))
$hash = [Security.Cryptography.SHA256]::Create()
try {
  $entries = @($archive.Entries | Where-Object { $_.FullName -match '^dark-forest/(assets/|src/|docs/story/|docs/audio/|docs/hero-fx/|index.html$)' })
  $required = @('index.html', 'src/core/ui-skin.js', 'src/core/icon-art.js', 'src/core/loading-art.js', 'src/scenes/JournalScene.js')
  $required += @(Get-ChildItem (Join-Path $projectRoot 'assets/ui') -File | Where-Object { $_.Name -notlike '*-source-*' } | ForEach-Object { 'assets/ui/' + $_.Name })
  $required += @('src/core/story.js', 'src/core/story-assets.js', 'src/scenes/StoryScene.js')
  $required += @('src/core/audio.js', 'src/core/audio-assets.js', 'docs/audio/index.html', 'docs/audio/ASSETS.json')
  $required += @('src/core/hero-fx.js', 'src/core/hero-fx-assets.js', 'docs/hero-fx/index.html', 'docs/hero-fx/ASSET-AUDIT.json')
  $required += @(Get-ChildItem (Join-Path $projectRoot 'assets/anim') -File -Filter 'hero-fx-*.png' | ForEach-Object { 'assets/anim/' + $_.Name })
  $required += @(Get-ChildItem (Join-Path $projectRoot 'assets/audio') -File -Filter *.wav | ForEach-Object { 'assets/audio/' + $_.Name })
  $required += @(Get-ChildItem (Join-Path $projectRoot 'assets/story') -File -Filter *.webp | ForEach-Object { 'assets/story/' + $_.Name })
  $required += @('docs/story/index.html', 'docs/story/PREVIEW.json')
  $storyPreview = [IO.File]::ReadAllText((Join-Path $projectRoot 'docs/story/PREVIEW.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
  $required += @($storyPreview.screens | ForEach-Object { 'docs/story/' + $_ })
  if ($archive.Entries | Where-Object { $_.FullName -match '^dark-forest/docs/story/source/' }) { throw 'Story source originals must be excluded' }
  foreach ($name in $required) {
    if (-not ($archive.Entries | Where-Object { $_.FullName -eq ('dark-forest/' + $name) })) { throw ('Missing runtime file: ' + $name) }
  }
  foreach ($entry in $entries) {
    $relative = $entry.FullName.Substring('dark-forest/'.Length)
    $localStream = [IO.File]::OpenRead((Join-Path $projectRoot $relative))
    $zipStream = $entry.Open()
    try {
      $localHash = [BitConverter]::ToString($hash.ComputeHash($localStream))
      $zipHash = [BitConverter]::ToString($hash.ComputeHash($zipStream))
      if ($localHash -ne $zipHash) { throw ('Stale runtime file: ' + $relative) }
    } finally { $localStream.Dispose(); $zipStream.Dispose() }
  }
  $textureCount = @(Get-ChildItem (Join-Path $projectRoot 'assets/ui') -File | Where-Object { $_.Name -notlike '*-source-*' -and $_.Extension -in '.png','.webp' }).Count
  $report = @{ archive=$ArchivePath; runtimeEntries=$entries.Count; requiredEntries=$required.Count; uiTextures=$textureCount; hashes='all match workspace'; errors=@() }
  $report | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $projectRoot 'docs/ui-reference/runtime/PACKAGE-REPORT.json')
  $report | ConvertTo-Json
} finally { $archive.Dispose(); $hash.Dispose() }
