#!/usr/bin/env pwsh

# Runs the Vitest unit tests once and prints a compact result.
#
# Usage: ./scripts/test.ps1 [-Json] [-Path <paths>] [-MaxIssues <n>] [-Help]
#
# Exit codes: 0 every test passed (or none exist), 1 a test failed, 2 Vitest could not run.

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
Usage: test.ps1 [OPTIONS]

Runs the Vitest unit tests once and reports a one-line summary plus one line per failure.

OPTIONS:
  -Json              Emit a JSON object instead of text
  -Path <paths>      Limit the run to test files matching the given paths
  -MaxIssues <n>     Maximum failures to list (default 50)
  -Help              Show this help message

EXIT CODES:
  0  every test passed, or no test file exists yet
  1  at least one test failed
  2  Vitest could not run
'@
    exit $script:ExitPass
}

$vitestPath = 'node_modules/vitest/vitest.mjs'
$toolchainError = Test-Toolchain -RelativePath $vitestPath
if ($toolchainError) {
    Write-CheckResult -Name 'test' -Status 'ERROR' -Summary $toolchainError -AsJson:$Json
    exit $script:ExitError
}

$reportPath = Join-Path ([System.IO.Path]::GetTempPath()) ('boombastic-vitest-{0}.json' -f [guid]::NewGuid().ToString('n'))

try {
    $toolArgs = @('run', '--passWithNoTests', '--reporter=json', "--outputFile=$reportPath")
    if ($Path) {
        $toolArgs += $Path
    }

    $result = Invoke-NodeTool -RelativePath $vitestPath -ToolArgs $toolArgs

    $report = $null
    if (Test-Path -LiteralPath $reportPath) {
        try {
            $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
        }
        catch {
            $report = $null
        }
    }

    if (-not $report) {
        $detail = @($result.StdErr -split '\r?\n' | Where-Object { $_.Trim() }) | Select-Object -First 1
        if (-not $detail) {
            $detail = "vitest exited with code $($result.ExitCode) and produced no readable report"
        }
        Write-CheckResult -Name 'test' -Status 'ERROR' -Summary $detail -AsJson:$Json
        exit $script:ExitError
    }

    $total = [int]$report.numTotalTests
    if ($total -eq 0) {
        Write-CheckResult -Name 'test' -Status 'SKIP' -Summary 'no test files yet' -AsJson:$Json
        exit $script:ExitPass
    }

    $failed = [int]$report.numFailedTests
    $passed = [int]$report.numPassedTests
    $issues = @()

    foreach ($file in @($report.testResults)) {
        $relativePath = ConvertTo-RepoRelativePath -AbsolutePath $file.name
        foreach ($assertion in @($file.assertionResults)) {
            if ($assertion.status -ne 'failed') {
                continue
            }
            $message = @((@($assertion.failureMessages) -join "`n") -split '\r?\n' |
                    Where-Object { $_.Trim() }) | Select-Object -First 1
            $issues += '{0} {1} {2}' -f $relativePath, $assertion.fullName, $message
        }
    }

    $summary = "tests=$total passed=$passed failed=$failed"

    if ($failed -gt 0 -or $result.ExitCode -ne 0) {
        Write-CheckResult -Name 'test' -Status 'FAIL' -Summary $summary -Issues $issues -MaxIssues $MaxIssues -AsJson:$Json
        exit $script:ExitIssues
    }

    Write-CheckResult -Name 'test' -Status 'PASS' -Summary $summary -AsJson:$Json
    exit $script:ExitPass
}
finally {
    Remove-Item -LiteralPath $reportPath -ErrorAction SilentlyContinue
}
