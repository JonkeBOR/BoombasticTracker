#!/usr/bin/env pwsh

# Runs ESLint over the repository and prints a compact result.
#
# Usage: ./scripts/lint.ps1 [-Fix] [-Json] [-Path <paths>] [-MaxIssues <n>] [-Help]
#
# Exit codes: 0 clean, 1 lint errors found, 2 the linter could not run.

[CmdletBinding()]
param(
    [switch]$Fix,
    [switch]$Json,
    [string[]]$Path,
    [int]$MaxIssues = 50,
    [switch]$Help
)

. (Join-Path $PSScriptRoot 'common.ps1')

if ($Help) {
    Write-Output @"
Usage: lint.ps1 [OPTIONS]

Runs ESLint and reports a one-line summary plus one line per problem.

OPTIONS:
  -Fix               Apply auto-fixable fixes before reporting
  -Json              Emit a JSON object instead of text
  -Path <paths>      Limit the run to specific files or directories
  -MaxIssues <n>     Maximum problems to list (default 50)
  -Help              Show this help message

EXIT CODES:
  0  no errors
  1  errors found
  2  ESLint could not run
"@
    exit $script:ExitPass
}

$eslintPath = 'node_modules/eslint/bin/eslint.js'
$toolchainError = Test-Toolchain -RelativePath $eslintPath
if ($toolchainError) {
    Write-CheckResult -Name 'lint' -Status 'ERROR' -Summary $toolchainError -AsJson:$Json
    exit $script:ExitError
}

$targets = if ($Path) { @($Path) } else { @('.') }
$toolArgs = @($targets) + @('--format', 'json')
if ($Fix) {
    $toolArgs += '--fix'
}

$result = Invoke-NodeTool -RelativePath $eslintPath -ToolArgs $toolArgs

try {
    $report = if ([string]::IsNullOrWhiteSpace($result.StdOut)) { @() } else { $result.StdOut | ConvertFrom-Json }
}
catch {
    $detail = if ($result.StdErr) { $result.StdErr.Trim() } else { 'ESLint produced unreadable output' }
    Write-CheckResult -Name 'lint' -Status 'ERROR' -Summary ($detail -split "`n" | Select-Object -First 1) -AsJson:$Json
    exit $script:ExitError
}

$errorCount = 0
$warningCount = 0
$issues = @()

foreach ($file in $report) {
    $errorCount += $file.errorCount
    $warningCount += $file.warningCount
    $relativePath = ConvertTo-RepoRelativePath -AbsolutePath $file.filePath

    foreach ($message in $file.messages) {
        $severity = if ($message.severity -eq 2) { 'error' } else { 'warning' }
        $rule = if ($message.ruleId) { $message.ruleId } else { 'parse' }
        $issues += "{0}:{1}:{2} {3} {4} {5}" -f $relativePath, $message.line, $message.column, $severity, $rule, $message.message
    }
}

$filesWithProblems = @($report | Where-Object { $_.errorCount -gt 0 -or $_.warningCount -gt 0 }).Count
$summary = "errors=$errorCount warnings=$warningCount files=$filesWithProblems"

if ($errorCount -gt 0) {
    Write-CheckResult -Name 'lint' -Status 'FAIL' -Summary $summary -Issues $issues -MaxIssues $MaxIssues -AsJson:$Json
    exit $script:ExitIssues
}

Write-CheckResult -Name 'lint' -Status 'PASS' -Summary $summary -Issues $issues -MaxIssues $MaxIssues -AsJson:$Json
exit $script:ExitPass
