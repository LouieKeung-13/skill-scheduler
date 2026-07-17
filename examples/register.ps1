# ============================================================
# 一键注册脚本 (PowerShell) — 将新 skill 添加到 catalog.json
# ============================================================
# 用法:
#   ./examples/register.ps1 -Id <skill-id> -Name "<name>" -Desc "<description>" -Category "<category>" -Triggers @("触发词1", "触发词2")
#
# 示例:
#   ./examples/register.ps1 -Id "my-translate" -Name "My Translator" -Desc "多语言翻译工具" -Category "content-gen" -Triggers @("翻译", "translate")
# ============================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Id,

    [Parameter(Mandatory=$true)]
    [string]$Name,

    [Parameter(Mandatory=$true)]
    [string]$Desc,

    [Parameter(Mandatory=$true)]
    [string]$Category,

    [Parameter(Mandatory=$true)]
    [string[]]$Triggers
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$catalogPath = Join-Path (Split-Path -Parent $scriptDir) "catalog.json"

# 读取现有 catalog
if (-not (Test-Path $catalogPath)) {
    '{"version":"1.0","skills":{}}' | Out-File -Encoding utf8 $catalogPath
}

$catalog = Get-Content $catalogPath -Raw | ConvertFrom-Json

# 添加新 skill
$catalog.skills.$Id = @{
    id = $Id
    name = $Name
    description = $Desc
    category = $Category
    triggers = $Triggers
    confidence_threshold = 0.7
    requires_setup = $false
    setup_notes = $null
}

$catalog | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 $catalogPath

Write-Output "✅ 已注册 skill: $($Id)"
Write-Output "   名称: $($Name)"
Write-Output "   类别: $($Category)"
Write-Output "   触发词: $($Triggers -join ', ')"
