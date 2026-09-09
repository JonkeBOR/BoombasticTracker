#!/usr/bin/env pwsh

# Checks (or applies) Prettier formatting and prints a compact result.
#
# Usage: ./scripts/format.ps1 [-Write] [-Json] [-Path <paths>] [-MaxIssues <n>] [-Help]
#
# Exit codes: 0 formatted correctly, 1 unformatted files found, 2 Prettier could not run.

[CmdletBinding()]
param(
    [switch]$Write,
    [switch]$Json,
    [string[]]$Path,
    [int]$MaxIssues = 50,
    [switch]$Help
)

. (Join-Path $PSScriptRoot 'common.ps1')

if ($Help) {
    Write-Output @'
Usage: format.ps1 [OPTIONS]

Reports which files are not Prettier-formatted, or rewrites them with -Write.

OPTIONS:
  -Write             Rewrite unformatted files instead of only reporting them
  -Json              Emit a JSON object instead of text
  -Path <paths>      Limit the run to specific files or directories
  -MaxIssues <n>     Maximum files to list (default 50)
  -Help              Show this help message

EXIT CODES:
  0  everything is formatted (or was rewritten)
  1  unformatted files found
  2  Prettier could not run
'@
    exit $script:ExitPass
}

$prettierPath = 'node_modules/prettier/bin/prettier.cjs'
$toolchainError = Test-Toolchain -RelativePath $prettierPath
if ($toolchainError) {
    Write-CheckResult -Name 'format' -Status 'ERROR' -Summary $toolchainError -AsJson:$Json
    exit $script:ExitError
}

$targets = if ($Path) { @($Path) } else { @('.') }
$mode = if ($Write) { @('--write', '--list-different') } else { @('--list-different') }
$result = Invoke-NodeTool -RelativePath $prettierPath -ToolArgs (@($mode) + $targets)

if ($result.ExitCode -gt 1) {
    $detail = ($result.StdErr -split '\r?\n' | Where-Object { $_.Trim() } | Select-Object -First 1)
    if (-not $detail) {
        $detail = "prettier exited with code $($result.ExitCode)"
    }
    Write-CheckResult -Name 'format' -Status 'ERROR' -Summary $detail -AsJson:$Json
    exit $script:ExitError
}

$files = @($result.StdOut -split '\r?\n' | Where-Object { $_.Trim() } | ForEach-Object {
        ConvertTo-RepoRelativePath -AbsolutePath $_.Trim()
    })

if ($Write) {
    Write-CheckResult -Name 'format' -Status 'WRITTEN' -Summary ('files={0}' -f $files.Count) -Issues $files -MaxIssues $MaxIssues -AsJson:$Json
    exit $script:ExitPass
}

if ($files.Count -eq 0) {
    Write-CheckResult -Name 'format' -Status 'PASS' -Summary 'unformatted=0' -AsJson:$Json
    exit $script:ExitPass
}

Write-CheckResult -Name 'format' -Status 'FAIL' -Summary ('unformatted={0}' -f $files.Count) -Issues $files -MaxIssues $MaxIssues -AsJson:$Json
exit $script:ExitIssues
