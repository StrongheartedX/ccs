# CCS - Claude Code Switch (Windows PowerShell)
# Cross-platform Claude CLI profile switcher using environment variables
# https://github.com/kaitranntt/ccs

param(
    [Parameter(Position=0)]
    [string]$Profile = "default",

    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$RemainingArgs
)

$ErrorActionPreference = "Stop"

# Config file location (supports environment variable override)
$ConfigFile = if ($env:CCS_CONFIG) {
    $env:CCS_CONFIG
} else {
    "$env:USERPROFILE\.ccs\config.json"
}

# Check config exists
if (-not (Test-Path $ConfigFile)) {
    Write-Host "Error: Config file not found: $ConfigFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Create $env:USERPROFILE\.ccs\config.json with your profile mappings."
    Write-Host "See .ccs.example.json for template."
    exit 1
}

# Validate profile name (alphanumeric, dash, underscore only)
if ($Profile -notmatch '^[a-zA-Z0-9_-]+$') {
    Write-Host "Error: Invalid profile name. Use only alphanumeric characters, dash, or underscore." -ForegroundColor Red
    exit 1
}

# Read and parse JSON config
try {
    $ConfigContent = Get-Content $ConfigFile -Raw -ErrorAction Stop
    $Config = $ConfigContent | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Host "Error: Invalid JSON in $ConfigFile" -ForegroundColor Red
    exit 1
}

# Validate config has profiles object
if (-not $Config.profiles) {
    Write-Host "Error: Config must have 'profiles' object" -ForegroundColor Red
    Write-Host "See .ccs.example.json for correct format"
    exit 1
}

# Get profile config
$ProfileConfig = $Config.profiles.$Profile

if (-not $ProfileConfig) {
    Write-Host "Error: Profile '$Profile' not found in $ConfigFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available profiles:"
    $Config.profiles.PSObject.Properties.Name | ForEach-Object {
        Write-Host "  - $_"
    }
    exit 1
}

# Profile config can be either a string (settings file path) or object (env vars)
# For backward compatibility with Unix, support both formats

if ($ProfileConfig -is [string]) {
    # Legacy format: path to settings file (for cross-platform configs)
    # This won't work on Windows Claude CLI, show helpful error
    Write-Host "Error: Windows Claude CLI doesn't support settings files." -ForegroundColor Red
    Write-Host ""
    Write-Host "Windows uses environment variables instead."
    Write-Host "Update your profile in $ConfigFile to use this format:"
    Write-Host ""
    Write-Host '  "' + $Profile + '": {'
    Write-Host '    "ANTHROPIC_AUTH_TOKEN": "your_api_key",'
    Write-Host '    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",'
    Write-Host '    "ANTHROPIC_MODEL": "glm-4.6"'
    Write-Host '  }'
    Write-Host ""
    Write-Host "Or leave empty {} for Claude subscription (no API key needed)."
    exit 1
}

# Apply environment variables from profile
# Save original values to restore after command execution
$OriginalEnvVars = @{}

if ($ProfileConfig.PSObject.Properties.Count -gt 0) {
    foreach ($Property in $ProfileConfig.PSObject.Properties) {
        $VarName = $Property.Name
        $VarValue = $Property.Value

        # Save original value
        $OriginalEnvVars[$VarName] = [System.Environment]::GetEnvironmentVariable($VarName, 'Process')

        # Set new value for this process
        [System.Environment]::SetEnvironmentVariable($VarName, $VarValue, 'Process')
    }
}

# Execute claude with environment variables set
try {
    if ($RemainingArgs) {
        & claude @RemainingArgs
    } else {
        & claude
    }
    $ExitCode = $LASTEXITCODE
} finally {
    # Restore original environment variables
    foreach ($VarName in $OriginalEnvVars.Keys) {
        $OriginalValue = $OriginalEnvVars[$VarName]
        if ($null -eq $OriginalValue) {
            # Variable didn't exist before, remove it
            [System.Environment]::SetEnvironmentVariable($VarName, $null, 'Process')
        } else {
            # Restore original value
            [System.Environment]::SetEnvironmentVariable($VarName, $OriginalValue, 'Process')
        }
    }
}

exit $ExitCode
