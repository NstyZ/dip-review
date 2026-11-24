$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== DIP 刷题站 · GitHub Pages 发布 ===" -ForegroundColor Cyan
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "未找到 GitHub CLI。请先安装：https://cli.github.com/" -ForegroundColor Red
  exit 1
}
gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "需要先登录 GitHub..." -ForegroundColor Yellow
  gh auth login
}
$Repo = Read-Host "输入 GitHub 仓库名（直接回车使用 dip-review）"
if ([string]::IsNullOrWhiteSpace($Repo)) { $Repo = "dip-review" }

if (-not (Test-Path ".git")) { git init -b main | Out-Null }
$name = git config user.name
if ([string]::IsNullOrWhiteSpace($name)) {
  $name = Read-Host "输入 Git 提交姓名"
  git config user.name $name
}
$email = git config user.email
if ([string]::IsNullOrWhiteSpace($email)) {
  $email = Read-Host "输入 Git 提交邮箱"
  git config user.email $email
}
git add .
git commit -m "Publish DIP quiz site" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "没有新改动需要提交，继续发布..." -ForegroundColor Yellow }

$remotes = git remote
if ($remotes -notcontains "origin") {
  gh repo create $Repo --public --source=. --remote=origin --push
} else {
  git push -u origin main
}
$owner = gh api user -q .login
$full = "$owner/$Repo"
Write-Host "仓库地址：https://github.com/$full" -ForegroundColor Green

try {
  $body = '{"source":{"branch":"main","path":"/"}}'
  $body | gh api -X POST "repos/$full/pages" --input - | Out-Null
  Write-Host "已尝试开启 GitHub Pages。" -ForegroundColor Green
} catch {
  Write-Host "Pages 可能已开启或需要手动设置，请到 Settings → Pages 检查。" -ForegroundColor Yellow
}
Start-Sleep -Seconds 2
try {
  $url = gh api "repos/$full/pages" -q .html_url
  Write-Host "公网地址：$url" -ForegroundColor Green
} catch {
  Write-Host "请打开：https://github.com/$full/settings/pages" -ForegroundColor Yellow
}
Start-Process "https://github.com/$full/settings/pages"
