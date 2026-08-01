Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
command = "cmd /c cd /d """ & base & """ && node desktop-launcher.js"
shell.Run command, 0, False
