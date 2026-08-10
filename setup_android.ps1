$ErrorActionPreference = "Stop"
$setupDir = "C:\Users\admin\AppData\Local\AndroidBuildSetup"
New-Item -ItemType Directory -Force -Path $setupDir | Out-Null

Write-Host "Downloading Microsoft OpenJDK 17..."
$jdkZip = "$setupDir\jdk17.zip"
Invoke-WebRequest -Uri "https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip" -OutFile $jdkZip
Write-Host "Extracting JDK..."
$javaTarget = "C:\Users\admin\AppData\Local\Java"
New-Item -ItemType Directory -Force -Path $javaTarget | Out-Null
Expand-Archive -Path $jdkZip -DestinationPath $javaTarget -Force
$jdkFolder = (Get-ChildItem -Path $javaTarget -Directory | Where-Object Name -like "jdk-17*").FullName
Write-Host "JDK Extracted to $jdkFolder"

Write-Host "Downloading Android Commandline Tools..."
$cmdToolsZip = "$setupDir\cmdline-tools.zip"
Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip" -OutFile $cmdToolsZip
Write-Host "Extracting Commandline Tools..."
$sdkTarget = "C:\Users\admin\AppData\Local\Android\Sdk"
$cmdlineTarget = "$sdkTarget\cmdline-tools\latest"
New-Item -ItemType Directory -Force -Path $sdkTarget | Out-Null
$tempExtract = "$setupDir\cmdline_temp"
Expand-Archive -Path $cmdToolsZip -DestinationPath $tempExtract -Force
New-Item -ItemType Directory -Force -Path $cmdlineTarget | Out-Null
Copy-Item -Path "$tempExtract\cmdline-tools\*" -Destination $cmdlineTarget -Recurse -Force
Write-Host "Android SDK extracted."
