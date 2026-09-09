#!/usr/bin/env pwsh

# Shared helpers for the BoombasticTracker quality scripts.
#
# Exit code contract used by every script that dot-sources this file:
#   0  the check passed (or was skipped because there is nothing to check yet)
#   1  the check ran and found issues
#   2  the check could not run (missing toolchain, unreadable tool output)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$script:ExitPass = 0
$script:ExitIssues = 1
$script:ExitError = 2

$script:Backslash = [char]92
$script:ForwardSlash = [char]47

function Get-RepoRoot {
    Split-Path -Parent $PSScriptRoot
}

function Get-ToolPath {
    param([Parameter(Mandatory)][string]$RelativePath)

    $full = Join-Path (Get-RepoRoot) $RelativePath
    if (-not (Test-Path -LiteralPath $full)) {
        return $null
    }
    return $full
}

function Test-Toolchain {
    param([Parameter(Mandatory)][string]$RelativePath)

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        return 'node was not found on PATH'
    }
    if (-not (Get-ToolPath -RelativePath $RelativePath)) {
        return "$RelativePath is missing - run 'npm install' first"
    }
    return $null
}

function Invoke-NodeTool {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [string[]]$ToolArgs = @()
    )

    $toolPath = Get-ToolPath -RelativePath $RelativePath

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'node'
    $startInfo.WorkingDirectory = (Get-RepoRoot)
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add($toolPath)
    foreach ($toolArgument in $ToolArgs) {
        $startInfo.ArgumentList.Add($toolArgument)
    }

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $standardOut = $process.StandardOutput.ReadToEnd()
    $standardError = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    try {
        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            StdOut   = $standardOut
            StdErr   = $standardError
        }
    }
    finally {
        $process.Dispose()
    }
}

function ConvertTo-RepoRelativePath {
    param([Parameter(Mandatory)][string]$AbsolutePath)

    $root = (Get-RepoRoot).TrimEnd($script:Backslash, $script:ForwardSlash).Replace($script:Backslash, $script:ForwardSlash)
    $normalized = $AbsolutePath.Replace($script:Backslash, $script:ForwardSlash)

    if ($normalized.StartsWith("$root$script:ForwardSlash", [System.StringComparison]::OrdinalIgnoreCase)) {
        return $normalized.Substring($root.Length + 1)
    }
    return $normalized
}

function Write-CheckResult {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Status,
        [string]$Summary = '',
        [string[]]$Issues = @(),
        [int]$MaxIssues = 50,
        [switch]$AsJson
    )

    if ($AsJson) {
        [pscustomobject]@{
            check   = $Name
            status  = $Status
            summary = $Summary
            issues  = $Issues
        } | ConvertTo-Json -Depth 4 -Compress
        return
    }

    $header = '{0}: {1}' -f $Name.ToUpperInvariant(), $Status
    if ($Summary) {
        $header = "$header  $Summary"
    }
    Write-Output $header

    if ($Issues.Count -eq 0) {
        return
    }

    $shown = [Math]::Min($Issues.Count, $MaxIssues)
    $Issues | Select-Object -First $shown | ForEach-Object { Write-Output "  $_" }

    if ($Issues.Count -gt $shown) {
        Write-Output ('  ... {0} more' -f ($Issues.Count - $shown))
    }
}
