@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo [INFO] JAVA_HOME is %JAVA_HOME%
echo [INFO] Checking Java version...
java -version

echo [INFO] Syncing Capacitor...
call npx cap sync

echo [INFO] Running on device 1485c4e9...
call npx cap run android --target 1485c4e9
