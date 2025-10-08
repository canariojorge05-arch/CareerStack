# PowerShell Script to start LibreOffice Conversion Service
Write-Host "Starting LibreOffice Conversion Service..." -ForegroundColor Green

# Configuration
$LIBREOFFICE_PATH = "C:\Program Files\LibreOffice\program"
$LIBREOFFICE_PYTHON = Join-Path $LIBREOFFICE_PATH "python.exe"
$LIBREOFFICE_SOFFICE = Join-Path $LIBREOFFICE_PATH "soffice.exe"
$CONVERSION_SERVICE = Join-Path $PSScriptRoot "docker\libreoffice\conversion-service.py"

# Function to check if a port is in use
function Test-PortInUse {
    param($Port)
    $listener = $null
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
        $listener.Start()
        return $false
    } catch {
        return $true
    } finally {
        if ($listener) {
            $listener.Stop()
        }
    }
}

# Stop existing LibreOffice processes
Write-Host "Stopping any existing LibreOffice processes..." -ForegroundColor Yellow
taskkill /F /IM soffice.exe 2>$null
Start-Sleep -Seconds 2

# Check if port 2002 is available
if (Test-PortInUse -Port 2002) {
    Write-Host "Port 2002 is already in use. Please ensure no other LibreOffice instances are running." -ForegroundColor Red
    exit 1
}

# Start LibreOffice in headless mode
Write-Host "Starting LibreOffice in headless mode..." -ForegroundColor Yellow
Start-Process -FilePath $LIBREOFFICE_SOFFICE -ArgumentList @(
    '--headless',
    '--invisible',
    '--nocrashreport',
    '--nodefault',
    '--nofirststartwizard',
    '--nologo',
    '--norestore',
    '--accept=socket,host=127.0.0.1,port=2002;urp;StarOffice.ServiceManager'
) -WindowStyle Hidden

# Wait for LibreOffice to initialize
Write-Host "Waiting for LibreOffice to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Check if python-dotenv is installed
Write-Host "Checking Python dependencies..." -ForegroundColor Yellow
& $LIBREOFFICE_PYTHON -c "import dotenv" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing python-dotenv..." -ForegroundColor Yellow
    & $LIBREOFFICE_PYTHON -m pip install python-dotenv
}

# Set environment variables
$env:PYTHONPATH = $LIBREOFFICE_PATH
$env:FLASK_ENV = "development"

# Start the conversion service
Write-Host "Starting the conversion service..." -ForegroundColor Yellow
Write-Host "Service will be available at http://localhost:5000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the service" -ForegroundColor Cyan
Write-Host ""

try {
    & $LIBREOFFICE_PYTHON $CONVERSION_SERVICE
} finally {
    # Cleanup when script is stopped
    Write-Host "`nStopping LibreOffice processes..." -ForegroundColor Yellow
    taskkill /F /IM soffice.exe 2>$null
}