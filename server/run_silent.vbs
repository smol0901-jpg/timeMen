' СменаЛАН — запуск сервера без консоли (в фоне)
' Используется ярлыком на рабочем столе

Option Explicit

Dim objShell, objFSO, strBase, strPython, strScript
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strBase = objFSO.GetParentFolderName(WScript.ScriptFullName)
strScript = strBase & "\launcher.py"

' Определяем Python
On Error Resume Next
objShell.Exec("python --version")
If Err.Number = 0 Then
    strPython = "python"
Else
    On Error Resume Next
    objShell.Exec("py --version")
    If Err.Number = 0 Then
        strPython = "py"
    Else
        MsgBox "Python не найден! Запустите setup.vbs для установки.", vbCritical, "СменаЛАН"
        WScript.Quit 1
    End If
End If
On Error GoTo 0

' Запуск сервера в фоне (без окна консоли)
objShell.CurrentDirectory = strBase
objShell.Run strPython & " """ & strScript & """ --no-console", 0, False

' Ждём 2 секунды пока сервер запустится
WScript.Sleep 2000

' Открываем браузер
objShell.Run "http://localhost:8080", 1, False

Set objFSO = Nothing
Set objShell = Nothing
