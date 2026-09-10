#!/usr/bin/env pwsh

# Runs the Playwright end-to-end tests and prints a compact result.
#
# Usage: ./scripts/e2e.ps1 [-Json] [-Path <paths>] [-MaxIssues <n>] [-Help]
#
# Playwright starts the dev server itself and reuses one already listening on port 3000.
#
# Exit codes: 0 every test passed (or none exist), 1 a test failed, 2 Playwright could not run.

[CmdletBinding()]
param(
    [switch]$Json,
    [string[]]$Path,
    [int]$MaxIssues = 50,
    [switch]$Help
)

. (Join-Path $PSScriptRoot 'common.ps1')

if ($Help) {
    Write-Output @'
Usage: e2e.ps1 [OPTIONS]

Runs the Playwright end-to-end tests and reports a one-line summary plus one line per failure.
The dev server is started automatically, or reused if one is already running.

OPTIONS:
  -Json              Emit a JSON object instead of text
  -Path <paths>      Limit the run to spec files matching the given paths
  -MaxIssues <n>     Maximum failures to list (default 50)
  -Help              Show this help message

EXIT CODES:
  0  every test passed, or no spec file exists yet
  1  at least one test failed
  2  Playwright could not run (missing toolchain or browser)
'@
    exit $script:ExitPass
}

function Get-PlaywrightFailure {
    param([Parameter(Mandatory)]$Suite)

    $failures = @()

    foreach ($spec in @($Suite.specs | Where-Object { $_ })) {
        if ($spec.ok) {
            continue
        }
        $message = @($spec.tests.results.errors.message | Where-Object { $_ }) | Select-Object -First 1
        $firstLine = if ($message) {
            @($message -split '\r?\n' | Where-Object { $_.Trim() }) | Select-Object -First 1
        }
        else {
            'failed'
        }
        $failures += '{0}:{1} {2} {3}' -f $spec.file, $spec.line, $spec.title, $firstLine
    }

    foreach ($child in @($Suite.suites | Where-Object { $_ })) {
        $failures += Get-PlaywrightFailure -Suite $child
    }

    return $failures
}

$playwrightPath = 'node_modules/@playwright/test/cli.js'
$toolchainError = Test-Toolchain -RelativePath $playwrightPath
if ($toolchainError) {
    Write-CheckResult -Name 'e2e' -Status 'ERROR' -Summary $toolchainError -AsJson:$Json
    exit $script:ExitError
}

$toolArgs = @('test', '--reporter=json')
if ($Path) {
    $toolArgs += $Path
}

$result = Invoke-NodeTool -RelativePath $playwrightPath -ToolArgs $toolArgs

if ("$($result.StdOut)$($result.StdErr)" -match "Executable doesn't exist") {
    Write-CheckResult -Name 'e2e' -Status 'ERROR' -Summary "playwright browsers are missing - run 'npm run e2e:install' first" -AsJson:$Json
    exit $script:ExitError
}

$report = $null
$jsonStart = $result.StdOut.IndexOf('{')
$jsonEnd = $result.StdOut.LastIndexOf('}')
if ($jsonStart -ge 0 -and $jsonEnd -gt $jsonStart) {
    try {
        $report = $result.StdOut.Substring($jsonStart, $jsonEnd - $jsonStart + 1) | ConvertFrom-Json
    }
    catch {
        $report = $null
    }
}

if (-not $report) {
    $detail = @($result.StdErr -split '\r?\n' | Where-Object { $_.Trim() }) | Select-Object -First 1
    if (-not $detail) {
        $detail = "playwright exited with code $($result.ExitCode) and produced unreadable output"
    }
    Write-CheckResult -Name 'e2e' -Status 'ERROR' -Summary $detail -AsJson:$Json
    exit $script:ExitError
}

if (@($report.errors).Count -gt 0) {
    $detail = @($report.errors.message | Where-Object { $_ }) | Select-Object -First 1
    if (-not $detail) {
        $detail = 'playwright reported a run-level error'
    }
    Write-CheckResult -Name 'e2e' -Status 'ERROR' -Summary (@($detail -split '\r?\n' | Where-Object { $_.Trim() }) | Select-Object -First 1) -AsJson:$Json
    exit $script:ExitError
}

$passed = [int]$report.stats.expected
$failed = [int]$report.stats.unexpected
$flaky = [int]$report.stats.flaky
$skipped = [int]$report.stats.skipped
$total = $passed + $failed + $flaky

if ($total -eq 0 -and $skipped -eq 0) {
    Write-CheckResult -Name 'e2e' -Status 'SKIP' -Summary 'no spec files yet' -AsJson:$Json
    exit $script:ExitPass
}

$issues = @()
foreach ($suite in @($report.suites | Where-Object { $_ })) {
    $issues += Get-PlaywrightFailure -Suite $suite
}

$summary = "tests=$total passed=$passed failed=$failed flaky=$flaky skipped=$skipped"

if ($failed -gt 0 -or $result.ExitCode -ne 0) {
    Write-CheckResult -Name 'e2e' -Status 'FAIL' -Summary $summary -Issues $issues -MaxIssues $MaxIssues -AsJson:$Json
    exit $script:ExitIssues
}

Write-CheckResult -Name 'e2e' -Status 'PASS' -Summary $summary -AsJson:$Json
exit $script:ExitPass
