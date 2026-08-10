@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd android
call gradlew.bat assembleDebug
if %ERRORLEVEL% EQU 0 (
    echo BUILD SUCCESSFUL
    cd ..
    "C:\Users\MSI\AppData\Local\Android\Sdk\platform-tools\adb.exe" install -r android\app\build\outputs\apk\debug\app-debug.apk
) else (
    echo BUILD FAILED
)
pause
