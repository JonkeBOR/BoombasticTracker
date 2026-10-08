#!/usr/bin/env pwsh

# Builds the Worker with OpenNext and checks it against the Cloudflare Workers limits.
#
# Usage: ./scripts/bundle.ps1 [-Json] [-Help]
#
# The size is the uncompressed upload reported by "wrangler deploy --dry-run", limited to 64 MiB.
# The startup time is the active CPU time of the Worker's top-level code reported by
# "wrangler check startup", limited to 1 second. It is measured on this machine, not on Cloudflare.
#
# Exit codes: 0 within both limits, 1 a limit is exceeded, 2 the build or a measurement failed.

[CmdletBinding()]
param(
    [switch]$Json,
    [switch]$Help
)

. (Join-Path $PSScriptRoot 'common.ps1')

if ($Help) {
    Write-Output @'
Usage: bundle.ps1 [OPTIONS]

Builds the Worker with OpenNext, then reports its uncompressed upload size against the 64 MiB
limit and its local startup CPU time against the 1 second limit. Takes about a minute.

OPTIONS:
  -Json              Emit a JSON object instead of text
  -Help              Show this help message

EXIT CODES:
  0  the Worker is within both limits
  1  the Worker exceeds a limit
  2  the build or a measurement could not run
'@
    exit $script:ExitPass
}

$sizeLimitKiB = 64 * 1024
$startupLimitMs = 1000

$openNextPath = 'node_modules/@opennextjs/cloudflare/dist/cli/index.js'
$wranglerPath = 'node_modules/wrangler/bin/wrangler.js'

foreach ($toolPath in @($openNextPath, $wranglerPath)) {
    $toolchainError = Test-Toolchain -RelativePath $toolPath
    if ($toolchainError) {
        Write-CheckResult -Name 'bundle' -Status 'ERROR' -Summary $toolchainError -AsJson:$Json
        exit $script:ExitError
    }
}

function Get-FirstErrorLine {
    param([Parameter(Mandatory)]$Result)

    $lines = @("$($Result.StdErr)`n$($Result.StdOut)" -split '\r?\n' | Where-Object { $_ -match 'error' })
    if ($lines.Count -gt 0) {
        return $lines[0].Trim()
    }
    return "exited with code $($Result.ExitCode)"
}

$build = Invoke-NodeTool -RelativePath $openNextPath -ToolArgs @('build')
if ($build.ExitCode -ne 0) {
    Write-CheckResult -Name 'bundle' -Status 'ERROR' -Summary ('build failed: {0}' -f (Get-FirstErrorLine -Result $build)) -AsJson:$Json
    exit $script:ExitError
}

$measureDirectory = Join-Path (Get-RepoRoot) '.open-next/bundle-check'
New-Item -ItemType Directory -Force -Path $measureDirectory | Out-Null
$bundlePath = Join-Path $measureDirectory 'worker.bundle'
$profilePath = Join-Path $measureDirectory 'startup.cpuprofile'

$dryRun = Invoke-NodeTool -RelativePath $wranglerPath -ToolArgs @('deploy', '--dry-run', '--outfile', $bundlePath)
if ($dryRun.ExitCode -ne 0 -or $dryRun.StdOut -notmatch 'Total Upload:\s+(?<size>[\d.]+)\s+(?<unit>KiB|MiB)') {
    Write-CheckResult -Name 'bundle' -Status 'ERROR' -Summary ('dry-run deploy failed: {0}' -f (Get-FirstErrorLine -Result $dryRun)) -AsJson:$Json
    exit $script:ExitError
}
$sizeKiB = [double]$Matches['size']
if ($Matches['unit'] -eq 'MiB') {
    $sizeKiB *= 1024
}

$startup = Invoke-NodeTool -RelativePath $wranglerPath -ToolArgs @('check', 'startup', '--worker', $bundlePath, '--outfile', $profilePath)
if ($startup.ExitCode -ne 0 -or $startup.StdOut -notmatch 'Active:\s+(?<active>[\d.]+)\s+ms') {
    Write-CheckResult -Name 'bundle' -Status 'ERROR' -Summary ('startup profile failed: {0}' -f (Get-FirstErrorLine -Result $startup)) -AsJson:$Json
    exit $script:ExitError
}
$startupMs = [double]$Matches['active']

$summary = 'size={0:N2}MiB/64MiB startup={1:N1}ms/1000ms' -f ($sizeKiB / 1024), $startupMs

$issues = @()
if ($sizeKiB -gt $sizeLimitKiB) {
    $issues += 'size {0:N2} MiB exceeds the 64 MiB uncompressed Worker limit' -f ($sizeKiB / 1024)
}
if ($startupMs -gt $startupLimitMs) {
    $issues += 'startup {0:N1} ms exceeds the 1 second Worker startup limit' -f $startupMs
}

if ($issues.Count -gt 0) {
    Write-CheckResult -Name 'bundle' -Status 'FAIL' -Summary $summary -Issues $issues -AsJson:$Json
    exit $script:ExitIssues
}

Write-CheckResult -Name 'bundle' -Status 'PASS' -Summary $summary -AsJson:$Json
exit $script:ExitPass
