' Launches the Paper Planner server hidden (no console window).
Dim shell, plannerDir
plannerDir = "c:\Users\joshu\OneDrive\Documents\DailyPlanner"
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = plannerDir
' 0 = hidden window, False = don't wait for it to exit
shell.Run """C:\nvm4w\nodejs\node.exe"" server.js", 0, False
