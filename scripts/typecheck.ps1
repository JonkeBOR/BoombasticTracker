#!/usr/bin/env pwsh

# Runs the TypeScript compiler in no-emit mode and prints a compact result.
#
# Usage: ./scripts/typecheck.ps1 [-Json] [-MaxIssues <n>] [-Help]
#
# Exit codes: 0 clean or nothing to check, 1 type errors found, 2 tsc could not run.

[CmdletBinding()]
param(
    [switch]$Json,
    [int]$MaxIssues = 50,
    [switch]$Help
)

. (Join-Path $PSScriptRoot 'common.ps1')

if ($Help) {
    Write-Output @'
Usage: typecheck.ps1 [OPTIONS]

Runs "tsc --noEmit" and reports a one-line summary plus one line per diagnostic.

OPTIONS:
  -Json              Emit a JSON object instead of text
  -MaxIssues <n>     Maximum diagnostics to list (default 50)
  -Help              Show this help message

EXIT CODES:
  0  no type errors, or no TypeScript sources exist yet
  1  type errors found
  2  tsc could not run
'@
    exit $script:ExitPass
}

$tscPath = 'node_modules/typescript/bin/tsc'
$toolchainError = Test-Toolchain -RelativePath $tscPath
if ($toolchainError) {
    Write-CheckResult -Name 'typecheck' -Status 'ERROR' -Summary $toolchainError -AsJson:$Json
    exit $script:ExitError
}

$result = Invoke-NodeTool -RelativePath $tscPath -ToolArgs @('--noEmit', '--pretty', 'false')
$output = @($result.StdOut, $result.StdErr) -join [System.Environment]::NewLine
$lines = $output -split '\r?\n' | Where-Object { $_.Trim() }

if ($lines | Where-Object { $_ -match 'error TS18003' }) {
    Write-CheckResult -Name 'typecheck' -Status 'SKIP' -Summary 'no TypeScript sources yet' -AsJson:$Json
    exit $script:ExitPass
}

$issues = @()
foreach ($line in $lines) {
    if ($line -match '^(?<file>.+?)\((?<line>\d+),(?<col>\d+)\):\s+error\s+(?<code>TS\d+):\s+(?<message>.+)$') {
        $relativePath = ConvertTo-RepoRelativePath -AbsolutePath $Matches['file']
        $issues += '{0}:{1}:{2} {3} {4}' -f $relativePath, $Matches['line'], $Matches['col'], $Matches['code'], $Matches['message']
    }
    elseif ($line -match '^error\s+(?<code>TS\d+):\s+(?<message>.+)$') {
        $issues += '{0} {1}' -f $Matches['code'], $Matches['message']
    }
}

if ($result.ExitCode -eq 0) {
    Write-CheckResult -Name 'typecheck' -Status 'PASS' -Summary 'errors=0' -AsJson:$Json
    exit $script:ExitPass
}

if ($issues.Count -eq 0) {
    $detail = ($lines | Select-Object -First 1)
    if (-not $detail) {
        $detail = "tsc exited with code $($result.ExitCode)"
    }
    Write-CheckResult -Name 'typecheck' -Status 'ERROR' -Summary $detail -AsJson:$Json
    exit $script:ExitError
}

Write-CheckResult -Name 'typecheck' -Status 'FAIL' -Summary ('errors={0}' -f $issues.Count) -Issues $issues -MaxIssues $MaxIssues -AsJson:$Json
exit $script:ExitIssues
