param(
  [string]$ProjectId = "ksync-prototype",
  [string]$Region = "asia-south1",
  [string]$ServiceName = "k-sync-backend",
  [string]$RepositoryName = "k-sync",
  [string]$FrontendOrigins = "http://localhost:5173",
  [string]$RedisUrl = "",
  [string]$BackendEnvPath = "backend/.env"
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Env file not found: $Path"
  }

  $values = @{}

  foreach ($line in Get-Content $Path) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.Trim().StartsWith("#")) {
      continue
    }

    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) {
      continue
    }

    $key = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"')
    $values[$key] = $value
  }

  return $values
}

function Ensure-Secret {
  param(
    [string]$Project,
    [string]$Name,
    [string]$Value
  )

  $exists = gcloud secrets describe $Name --project=$Project 2>$null

  if (-not $?) {
    $Value | gcloud secrets create $Name --project=$Project --replication-policy=automatic --data-file=-
    return
  }

  $Value | gcloud secrets versions add $Name --project=$Project --data-file=-
}

$envValues = Read-EnvFile -Path $BackendEnvPath
$databaseUrl = $envValues["DATABASE_URL"]
$directUrl = $envValues["DIRECT_URL"]

if (-not $databaseUrl -or -not $directUrl) {
  throw "DATABASE_URL and DIRECT_URL must exist in $BackendEnvPath"
}

if (-not $RedisUrl) {
  $RedisUrl = $envValues["REDIS_URL"]
}

if (-not $RedisUrl -or $RedisUrl -match "localhost|127\.0\.0\.1") {
  throw "Provide a hosted Redis URL through -RedisUrl. The local redis URL cannot be used for Cloud Run."
}

$imageUri = "$Region-docker.pkg.dev/$ProjectId/$RepositoryName/$ServiceName`:latest"

gcloud services enable `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  secretmanager.googleapis.com `
  --project=$ProjectId

$repoCheck = gcloud artifacts repositories describe $RepositoryName --location=$Region --project=$ProjectId 2>$null
if (-not $?) {
  gcloud artifacts repositories create $RepositoryName `
    --repository-format=docker `
    --location=$Region `
    --project=$ProjectId
}

Ensure-Secret -Project $ProjectId -Name "ksync-database-url" -Value $databaseUrl
Ensure-Secret -Project $ProjectId -Name "ksync-direct-url" -Value $directUrl

gcloud builds submit backend --tag $imageUri --project=$ProjectId

gcloud run deploy $ServiceName `
  --image=$imageUri `
  --region=$Region `
  --project=$ProjectId `
  --allow-unauthenticated `
  --port=8080 `
  --cpu=1 `
  --memory=1Gi `
  --min-instances=1 `
  --max-instances=1 `
  --no-cpu-throttling `
  --set-env-vars="NODE_ENV=production,PORT=8080,FRONTEND_URLS=$FrontendOrigins,REDIS_URL=$RedisUrl,CONFLICT_WINDOW_SECONDS=10,QUEUE_MAX_ATTEMPTS=3,ENABLE_POLLER=false,POLLER_INTERVAL_SECONDS=300,RUN_MIGRATIONS_ON_STARTUP=true,RUN_SEED_ON_STARTUP=false" `
  --set-secrets="DATABASE_URL=ksync-database-url:latest,DIRECT_URL=ksync-direct-url:latest"

Write-Host "Cloud Run deploy command completed for $ServiceName."
