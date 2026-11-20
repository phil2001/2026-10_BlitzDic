; Remove BlitzDic's Windows autostart entry (see src/login-item.js) when the app
; is uninstalled. An update also runs the old uninstaller; the entry then stays.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "BlitzDic"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "BlitzDic"
  ${endIf}
!macroend
