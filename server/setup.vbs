' СменаЛАН — автонастройка и запуск сервера (без консоли)
' Запуск: двойной клик по файлу
' Автоматически: проверяет Python, устанавливает зависимости, создаёт ярлык, запускает сервер

Option Explicit

Dim objShell, objFSO, objHTTP, strPython, strScript, strBase, strLog
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
Set objHTTP = CreateObject("MSXML2.XMLHTTP")

strBase = objFSO.GetParentFolderName(WScript.ScriptFullName)
strScript = strBase & "\server\launcher.py"
strLog = strBase & "\server\setup.log"

' Логирование
Sub LogMsg(msg)
    Dim f
    Set f = objFSO.OpenTextFile(strLog, 8, True)
    f.WriteLine Now & " - " & msg
    f.Close
End Sub

LogMsg "=== Начало автонастройки ==="

' Проверка Python
strPython = ""
On Error Resume Next
strPython = objShell.Exec("python --version").StdOut.ReadAll
If Err.Number <> 0 Or InStr(strPython, "Python") = 0 Then
    On Error Resume Next
    strPython = objShell.Exec("py --version").StdOut.ReadAll
    If Err.Number <> 0 Or InStr(strPython, "Python") = 0 Then
        LogMsg "Python не найден"
        MsgBox "Python не установлен!" & vbCrLf & vbCrLf & _
               "Скачайте с python.org и установите с опцией 'Add to PATH'", vbCritical, "СменаЛАН"
        WScript.Quit 1
    Else
        strPython = "py"
    End If
Else
    strPython = "python"
End If
On Error GoTo 0

LogMsg "Python найден: " & strPython

' Установка зависимостей
LogMsg "Установка зависимостей..."
objShell.CurrentDirectory = strBase & "\server"
objShell.Run strPython & " -m pip install -r requirements.txt --quiet", 0, True
LogMsg "Зависимости установлены"

' Создание ярлыка на рабочем столе
Dim strDesktop, strShortcut
strDesktop = objShell.SpecialFolders("Desktop")
strShortcut = strDesktop & "\СменаЛАН — сервер.lnk"

If Not objFSO.FileExists(strShortcut) Then
    Dim objLink
    Set objLink = objShell.CreateShortcut(strShortcut)
    objLink.TargetPath = "wscript.exe"
    objLink.Arguments = """" & strBase & "\server\run_silent.vbs"""
    objLink.WorkingDirectory = strBase & "\server"
    objLink.IconLocation = "%SystemRoot%\System32\shell32.dll,176"
    objLink.Description = "СменаЛАН — локальный сервер учёта смен"
    objLink.Save
    LogMsg "Ярлык создан: " & strShortcut
End If

' Проверка работоспособности сервера
LogMsg "Проверка сервера..."
On Error Resume Next
objHTTP.Open "GET", "http://localhost:8080/api/ping", False
objHTTP.Send
If Err.Number <> 0 Or objHTTP.Status <> 200 Then
    LogMsg "Сервер не запущен — запускаем..."
    objShell.Run "wscript.exe """ & strBase & "\server\run_silent.vbs""", 0, False
    WScript.Sleep 3000
    LogMsg "Сервер запущен"
Else
    LogMsg "Сервер уже работает"
End If
On Error GoTo 0

' Открытие браузера
LogMsg "Открытие браузера..."
objShell.Run "http://localhost:8080", 1, False

LogMsg "=== Автонастройка завершена ==="

MsgBox "СменаЛАН настроен и запущен!" & vbCrLf & vbCrLf & _
       "• Ярлык создан на рабочем столе" & vbCrLf & _
       "• Сервер работает в трее" & vbCrLf & _
       "• Браузер открыт" & vbCrLf & vbCrLf & _
       "Для остановки: правый клик на иконке в трее → Выйти", vbInformation, "СменаЛАН"

Set objHTTP = Nothing
Set objFSO = Nothing
Set objShell = Nothing
