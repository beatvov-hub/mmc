Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
app = base & "\dist\MMC Workline.exe"
If fso.FileExists(app) Then
  shell.Run """" & app & """", 1, False
Else
  command = "cmd /c cd /d """ & base & """ && npm.cmd start"
  shell.Run command, 0, False
End If
