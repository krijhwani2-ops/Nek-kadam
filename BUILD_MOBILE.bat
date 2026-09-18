@echo off
setlocal enabledelayedexpansion

if exist "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
) else if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
) else (
    echo Using default system Java...
)

if defined JAVA_HOME (
    set "PATH=%JAVA_HOME%\bin;%PATH%"
)

echo [1/3] Building web assets and syncing Capacitor...
call npm run build
call npx cap sync android

echo [2/3] Compiling Android APK with Gradle...
cd android
call gradlew.bat assembleDebug
set BUILD_ERR=%ERRORLEVEL%
cd ..

if %BUILD_ERR% EQU 0 (
    echo [3/3] BUILD SUCCESSFUL! Updating APK release files...
    if not exist "apk" mkdir "apk"
    copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "apk\app-debug.apk" >nul
    copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "apk\nek-kadam.apk" >nul
    copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "NekKadam.apk" >nul
    echo APK copied to apk\nek-kadam.apk and NekKadam.apk
) else (
    echo BUILD FAILED with exit code %BUILD_ERR%
)

pause
