# ============================================================================
# PantryButler — Windows startup script (PowerShell)
#
#   .\start-windows.ps1                  First run: builds containers, starts,
#                                        seeds nutrition, and creates the admin.
#   .\start-windows.ps1 -ResetDb         Optional: wipe the database volume
#                                        and restart fresh (destroys all data!).
#   .\start-windows.ps1 -EnableAdminFeatures
#                                        Enable the superadmin-only admin pages.
#   .\start-windows.ps1 -NoUpdate        Skip the git pull auto-update (local
#                                        testing before pushing to GitHub).
#   .\start-windows.ps1 -Url <url>        Public base URL for email links, e.g.
#                                        https://pantrybutler.example.com
#                                        (without it, prompts when interactive;
#                                        otherwise email links use localhost).
#
# If execution policy blocks scripts, run once:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# ============================================================================

param(
    [switch]$ResetDb,
    [switch]$EnableAdminFeatures,
    [switch]$NoUpdate,
    [string]$Url
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = $PSScriptRoot
$ComposeFile = Join-Path $ProjectRoot 'docker-compose.yml'
$EnvFile     = Join-Path $ProjectRoot 'docker\.env.2container'
$ComposeProject = 'PantryButler'

function Write-Step  { Write-Host "`n>>> $args" -ForegroundColor Green }
function Write-Ok    { Write-Host $args -ForegroundColor Green }
function Write-Warn  { Write-Host $args -ForegroundColor Yellow }
function Write-Fail  { Write-Host $args -ForegroundColor Red; exit 1 }

# ----------------------------------------------------------------------------
# Prerequisites
# ----------------------------------------------------------------------------
function Check-Prerequisites {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Fail "Docker is not installed. Install Docker Desktop for Windows: https://www.docker.com/products/docker-desktop/"
    }
    try {
        docker compose version *> $null
        if ($LASTEXITCODE -ne 0) { throw 'compose v2 not available' }
    } catch {
        Write-Fail "Docker Compose v2 is not available. Update Docker Desktop (Compose v2 ships with it)."
    }
    if (-not (Test-Path $ComposeFile)) {
        Write-Fail "docker-compose.yml not found at $ComposeFile. Run this script from the project root."
    }
}

function Update-Repo {
    Write-Step "Checking for updates..."
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Warn "git not found; skipping auto-update."
        return
    }
    try {
        $null = & git -C $ProjectRoot rev-parse --is-inside-work-tree
        if ($LASTEXITCODE -ne 0) { Write-Warn "Not a git repository; skipping auto-update."; return }
    } catch {
        Write-Warn "Not a git repository; skipping auto-update."
        return
    }
    try {
        & git -C $ProjectRoot pull --ff-only 2>&1
        Write-Ok "Update check complete."
    } catch {
        Write-Warn "git pull failed (network/credentials?) - continuing with current code."
    }
}

function Test-DockerVolume {
    param([string]$Name)
    try {
        & docker volume inspect $Name 2>&1 | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

# ----------------------------------------------------------------------------
# Environment / JWT secret
# ----------------------------------------------------------------------------
function Setup-Env {
    # On by default: scripts/smoke-test.py uses the superadmin admin instance-
    # delete API to leave no data behind. -EnableAdminFeatures is kept for
    # compatibility but is no longer required.
    $env:ENABLE_ADMIN_FEATURES = 'true'

    if (-not (Test-Path $EnvFile)) {
        Write-Step "Creating $EnvFile from template..."
        Copy-Item (Join-Path $ProjectRoot 'docker\.env.2container.example') $EnvFile
    }

    $content = Get-Content $EnvFile -Raw
    # Never ship / run with a known JWT_SECRET: the placeholder or any leaked
    # committed value is forgeable (the server refuses to boot with them).
    if ($content -match '^JWT_SECRET=(generate-a-random-64-char-string|577a1c275181d034a9bfef43ad38f910f47694574cd55d149c924b4e1cba2732|706943d4abc630b909ea7e9364ff35eaff7a9b9fdde4dddc785a553870bef67d)') {
        Write-Step "Generating a secure JWT_SECRET..."
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $bytes = New-Object byte[] 32
        $rng.GetBytes($bytes)
        $secret = [Convert]::ToHexString($bytes).ToLowerInvariant()
        $content = $content -replace '(?m)^JWT_SECRET=.*', "JWT_SECRET=$secret"
        Set-Content -Path $EnvFile -Value $content -NoNewline -Encoding ascii
        Write-Ok "JWT_SECRET generated."
    }

    # Same for the DB password: the server refuses to boot in production with
    # the well-known `changeme` placeholder (or the committed template value).
    if ($content -match '^POSTGRES_PASSWORD=(changeme|pb_local_9f2c4a7e_5b8d)') {
        Write-Step "Generating a secure POSTGRES_PASSWORD..."
        # A Postgres data volume freezes its password at first init. If one
        # already exists, do NOT rotate: changing the env value would desync the
        # app from the database (migrations/login fail with "password
        # authentication failed") and the only fix would be wiping the volume. So
        # only rotate on a fresh install (no existing volume); otherwise leave
        # the password as-is.
        if (Test-DockerVolume "PantryButler_pgdata") {
            Write-Warn "A DB volume already exists - leaving POSTGRES_PASSWORD unchanged so it stays in sync with the database."
            Write-Warn "To start fresh, remove the volume (docker compose down -v) and re-run."
        } else {
            $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
            $bytes = New-Object byte[] 16
            $rng.GetBytes($bytes)
            $dbPassword = [Convert]::ToHexString($bytes).ToLowerInvariant()
            $content = $content -replace '(?m)^POSTGRES_PASSWORD=.*', "POSTGRES_PASSWORD=$dbPassword"
            Set-Content -Path $EnvFile -Value $content -NoNewline -Encoding ascii
            Write-Ok "POSTGRES_PASSWORD generated."
        }
    }
}

# ----------------------------------------------------------------------------
# External / public URL (used in email verification links)
# ----------------------------------------------------------------------------
function Set-ExternalUrl {
    param([string]$CliUrl)

    $url = $CliUrl
    if (-not $url -and $env:APP_URL) { $url = $env:APP_URL }

    # Already pinned in the env file: respect it, no prompt.
    if (-not $url) {
        $c = Get-Content $EnvFile -Raw
        $m = [regex]::Match($c, '(?m)^APP_URL=(.*)$')
        if ($m.Success -and $m.Groups[1].Value.Trim() -ne '') {
            Write-Ok "Using APP_URL from $EnvFile: $($m.Groups[1].Value.Trim())"
            return
        }
    }

    if ($url) {
        $url = $url.TrimEnd('/')
        $c = Get-Content $EnvFile -Raw
        if ($c -match '(?m)^APP_URL=') {
            $c = $c -replace '(?m)^APP_URL=.*', "APP_URL=$url"
        } else {
            $c = $c.TrimEnd() + "`nAPP_URL=$url`n"
        }
        Set-Content -Path $EnvFile -Value $c -NoNewline -Encoding ascii
        Write-Ok "APP_URL set to $url (saved to $EnvFile)."
        return
    }

    # Nothing provided: only prompt when attached to an interactive terminal.
    if (-not [Environment]::UserInteractive -or [Console]::IsInputRedirected) {
        Write-Warn "Non-interactive run: APP_URL left unset (email links will use localhost)."
        Write-Warn "Set APP_URL=https://your.domain in docker\.env.2container to fix email links."
        return
    }

    $inputUrl = Read-Host -Prompt "Public URL for email links (e.g. https://pantrybutler.example.com), or leave blank for localhost"
    $inputUrl = $inputUrl.TrimEnd('/')
    if ($inputUrl) {
        $c = Get-Content $EnvFile -Raw
        if ($c -match '(?m)^APP_URL=') {
            $c = $c -replace '(?m)^APP_URL=.*', "APP_URL=$inputUrl"
        } else {
            $c = $c.TrimEnd() + "`nAPP_URL=$inputUrl`n"
        }
        Set-Content -Path $EnvFile -Value $c -NoNewline -Encoding ascii
        Write-Ok "APP_URL set to $inputUrl (saved to $EnvFile)."
    } else {
        Write-Warn "No public URL provided - email links will use localhost."
    }
}

# ----------------------------------------------------------------------------
# Start container
# ----------------------------------------------------------------------------
function Start-Containers {
    Set-Location $ProjectRoot
    Write-Step "Building and starting containers (project: $ComposeProject)..."
    docker compose -p $ComposeProject -f $ComposeFile --env-file $EnvFile up -d --build
    if ($LASTEXITCODE -ne 0) { Write-Fail 'docker compose up failed.' }

    Write-Step "Waiting for the app to become healthy..."
    $healthy = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $resp = docker compose -p $ComposeProject -f $ComposeFile --env-file $EnvFile exec pantrybutler wget --no-verbose --tries=1 --spider http://localhost:3000/api/health 2>&1
            if ($LASTEXITCODE -eq 0) { $healthy = $true; break }
        } catch {}
        Start-Sleep -Seconds 2
    }
    if (-not $healthy) {
        Write-Fail "App did not become healthy. Check logs: docker compose -p PantryButler logs pantrybutler"
    }
    Write-Ok "App is healthy."
}

# ----------------------------------------------------------------------------
# Reset database volume (destructive)
# ----------------------------------------------------------------------------
function Reset-Db {
    Write-Warn "DESTRUCTIVE: removing the PostgreSQL data volume (all data will be lost)."
    docker compose -p $ComposeProject down -v
    if ($LASTEXITCODE -ne 0) { Write-Fail 'docker compose down -v failed.' }
    Write-Ok "Database volume removed. Restarting fresh..."
}

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
function Show-Summary {
    Write-Host "`n======================================================" -ForegroundColor Green
    Write-Host "  PantryButler is running" -ForegroundColor Green
    Write-Host "  App:          http://localhost:3000" -ForegroundColor Green
    Write-Host "  Health:       http://localhost:3000/api/health" -ForegroundColor Green
    Write-Host "  Containers:   docker compose -p $ComposeProject ps" -ForegroundColor Green
    Write-Host "  Logs:         docker compose -p $ComposeProject logs -f" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host ""
    Write-Warn "Open http://localhost:3000 and sign in (first boot creates an admin automatically)."
    $currentContent = Get-Content $EnvFile -Raw
    if ($currentContent -match '^POSTGRES_PASSWORD=(changeme|pb_local_9f2c4a7e_5b8d)') {
        Write-Warn "Production? Change POSTGRES_PASSWORD in docker\.env.2container and"
        Write-Warn "restart (docker compose -p PantryButler up -d)."
    }
}

# ----------------------------------------------------------------------------
# Run setup (seed nutrition + create admin on first boot)
# ----------------------------------------------------------------------------
function Run-Setup {
    Write-Step "Checking if setup is needed..."

    # The status endpoint requires superadmin auth once any users exist, so an
    # unauthenticated call returns non-2xx. Only a *successful* response that
    # reports hasUsers:false means a genuine first boot; anything else (fetch
    # failure, 403, already-set-up) is treated as "nothing to do" so we don't
    # re-run seeding / admin creation on every update.
    $setupStatus = (curl.exe -s -f http://localhost:3000/api/setup/status 2>$null)

    if ($setupStatus -match '"hasUsers":false') {
        Write-Ok "First boot detected - running setup..."

        Write-Step "Seeding nutrition data..."
        $seedResponse = (curl.exe -s -f -X POST http://localhost:3000/api/setup/seed-nutrition 2>$null)
        if ($seedResponse -match '"success":true') {
            Write-Ok "Nutrition data seeded successfully."
        } else {
            Write-Warn "Nutrition seed response: $seedResponse"
        }

        Write-Step "Creating admin user..."
        $adminEmail = if ($env:ADMIN_EMAIL) { $env:ADMIN_EMAIL } else { "admin@pantrybutler.local" }
        if ($env:ADMIN_PASSWORD) {
            $adminPassword = $env:ADMIN_PASSWORD
        } else {
            # Reuse a previously generated admin password persisted in the env file, so a
            # database-volume reset during an update does not replace it with a new,
            # unknown password.
            $fileContent = Get-Content $EnvFile -Raw
            $existing = ($fileContent -split "`n" | Where-Object { $_ -match '^ADMIN_PASSWORD=' } | Select-Object -First 1)
            if ($existing) {
                $adminPassword = ($existing -replace '^ADMIN_PASSWORD=', '').Trim()
            } else {
                $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
                $b = New-Object byte[] 18
                $rng.GetBytes($b)
                $adminPassword = [Convert]::ToHexString($b).ToLowerInvariant()
                Add-Content -Path $EnvFile -Value "ADMIN_PASSWORD=$adminPassword"
            }
        }

        $body = @{ email = $adminEmail; password = $adminPassword; instance_name = "My Kitchen" } | ConvertTo-Json -Compress
        $registerResponse = (curl.exe -s -f -X POST http://localhost:3000/api/setup/create-admin -H "Content-Type: application/json" -d $body 2>$null)

        if ($registerResponse -match '"success":true') {
            Write-Ok "Admin user created: $adminEmail"
        } else {
            Write-Warn "Create-admin response: $registerResponse"
        }

        Write-Host ""
        Write-Host "======================================================" -ForegroundColor Green
        Write-Host "  SETUP COMPLETE" -ForegroundColor Green
        Write-Host "======================================================" -ForegroundColor Green
        Write-Host "  Admin email:    $adminEmail" -ForegroundColor Green
        Write-Host "  Admin password: $adminPassword" -ForegroundColor Green
        Write-Host "  App URL:        http://localhost:3000" -ForegroundColor Green
        Write-Host "======================================================" -ForegroundColor Green
        Write-Host ""
        if ($adminPassword.Length -lt 12 -or $adminPassword -eq 'admin123') {
            Write-Warn "CHANGE THE ADMIN PASSWORD AFTER FIRST LOGIN!"
        }
        $currentContent = Get-Content $EnvFile -Raw
        if ($currentContent -match '^POSTGRES_PASSWORD=(changeme|pb_local_9f2c4a7e_5b8d)') {
            Write-Warn "CHANGE POSTGRES_PASSWORD in docker\.env.2container FOR PRODUCTION!"
        }
    } else {
        Write-Ok "Setup already complete."
    }
}

# ----------------------------------------------------------------------------
Write-Host ""
Write-Host "PantryButler - Windows startup" -ForegroundColor Green

Check-Prerequisites
if (-not $NoUpdate) { Update-Repo }
if ($ResetDb) { Reset-Db }
Setup-Env
Set-ExternalUrl $Url
Start-Containers
Run-Setup
Show-Summary