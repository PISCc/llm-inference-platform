param(
  [string]$BackupRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) '..\backups')
)

$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$backupBase = [IO.Path]::GetFullPath($BackupRoot)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $backupBase "llm-inference-platform-$stamp"
New-Item -ItemType Directory -Path $target -Force | Out-Null

Push-Location $repo
try {
  $commit = (git rev-parse HEAD).Trim()
  $branch = (git branch --show-current).Trim()

  git bundle create (Join-Path $target 'repository.bundle') --all
  if ($LASTEXITCODE -ne 0) { throw 'git bundle 创建失败' }

  git diff --binary | Out-File -FilePath (Join-Path $target 'working-tree.patch') -Encoding utf8
  tar -a -c -f (Join-Path $target 'source.zip') --exclude=.git --exclude=node_modules --exclude=dev-server.log .
  if ($LASTEXITCODE -ne 0) { throw '源码 ZIP 创建失败' }

  $status = git status --short
  $manifest = @(
    "created_at=$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
    "repository=$repo"
    "branch=$branch"
    "commit=$commit"
    "working_tree_clean=$([string]::IsNullOrWhiteSpace(($status -join '')))"
    ''
    '[sha256]'
  )

  Get-ChildItem -LiteralPath $target -File | Where-Object Name -ne 'SHA256SUMS.txt' | ForEach-Object {
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant()
    $manifest += "$hash  $($_.Name)"
  }
  [IO.File]::WriteAllLines((Join-Path $target 'SHA256SUMS.txt'), $manifest, (New-Object Text.UTF8Encoding($false)))

  Write-Output $target
}
finally {
  Pop-Location
}
