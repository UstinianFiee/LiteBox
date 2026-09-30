param([Parameter(Mandatory=$true)][string]$Executable,[Parameter(Mandatory=$true)][string]$DataDirectory,[Parameter(Mandatory=$true)][string]$Report,[switch]$AllowConcurrentIsolatedLaunch)
$ErrorActionPreference='Stop'
$exe=(Resolve-Path -LiteralPath $Executable).Path
# The program chooses its own adjacent data directory. The argument must match it.
$expectedData=[IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $exe) 'litebox-data'))
if ([IO.Path]::GetFullPath($DataDirectory) -ne $expectedData) { throw 'DataDirectory must be litebox-data beside the test executable; it does not redirect storage.' }
if ($AllowConcurrentIsolatedLaunch) {
  # Explicitly allowed only for a fresh data path, never for an existing user profile.
  if (Test-Path -LiteralPath $expectedData) { throw 'Concurrent isolated launch requires a new test directory with no existing litebox-data.' }
} elseif (Get-Process LiteBox -ErrorAction SilentlyContinue) {
  throw 'An existing LiteBox instance is open; close it or use a brand-new isolated test directory with the explicit switch.'
}
$oldElectron=$env:ELECTRON_RUN_AS_NODE
$oldDev=$env:LITEBOX_DEV_URL
$oldPortable=$env:PORTABLE_EXECUTABLE_DIR
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Remove-Item Env:LITEBOX_DEV_URL -ErrorAction SilentlyContinue
Remove-Item Env:PORTABLE_EXECUTABLE_DIR -ErrorAction SilentlyContinue
if (!('LiteBoxReleaseWindows' -as [type])) {
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class LiteBoxReleaseWindows {
 public delegate bool Callback(IntPtr h, IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Callback c, IntPtr l);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool IsHungAppWindow(IntPtr h);
}
"@
}
$started=Get-Date
$proc=$null
$window=$null
try {
  $proc=Start-Process -FilePath $exe -PassThru -WindowStyle Hidden
  $owned=[System.Collections.Generic.HashSet[int]]::new()
  [void]$owned.Add($proc.Id)
  for($attempt=0;$attempt -lt 45;$attempt++) {
    Start-Sleep -Seconds 1
    $snapshot=Get-CimInstance Win32_Process
    for($round=0;$round -lt 5;$round++) {
      foreach($item in $snapshot) {
        if($owned.Contains([int]$item.ParentProcessId)) { [void]$owned.Add([int]$item.ProcessId) }
      }
    }
    $found=[System.Collections.Generic.List[object]]::new()
    [void][LiteBoxReleaseWindows]::EnumWindows({param($h,$l)
      $ownerId=[uint32]0
      [void][LiteBoxReleaseWindows]::GetWindowThreadProcessId($h,[ref]$ownerId)
      if($owned.Contains([int]$ownerId)) {
        $text=[System.Text.StringBuilder]::new(512)
        [void][LiteBoxReleaseWindows]::GetWindowText($h,$text,512)
        if($text.ToString() -match 'LiteBox' -and (Get-Process -Id $ownerId -ErrorAction SilentlyContinue).ProcessName -eq 'LiteBox') { $found.Add([pscustomobject]@{Handle=$h;Id=[int]$ownerId;Title=$text.ToString()}) }
      }
      return $true
    },[IntPtr]::Zero)
    $window=$found | Select-Object -First 1
    if($window) { break }
  }
  if(!$window) { throw 'No titled LiteBox window appeared within 45 seconds.' }
  $windowAppearedSeconds=[math]::Round(((Get-Date)-$started).TotalSeconds,2)
  Start-Sleep -Seconds 4
  $windowProcess=Get-Process -Id $window.Id
  if($windowProcess.HasExited -or [LiteBoxReleaseWindows]::IsHungAppWindow($window.Handle)) { throw 'Packaged application exited or is not responding.' }
  $title=$window.Title
  $pidValue=$window.Id
  if(!(Test-Path -LiteralPath $DataDirectory -PathType Container)) { throw 'Portable data folder was not created beside the executable.' }
  if(![LiteBoxReleaseWindows]::PostMessage($window.Handle,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)) { throw 'Could not close packaged application gracefully.' }
  if(!$windowProcess.WaitForExit(15000)) { throw 'Packaged application did not exit gracefully.' }
  $stateFile=Join-Path $DataDirectory 'state.json'
  if(!(Test-Path -LiteralPath $stateFile)) { throw 'State was not flushed on normal close.' }
  $state=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
  if($state.version -ne 1 -or $state.locale -ne 'zh') { throw 'Unexpected initial state after packaged launch.' }
  $result=[ordered]@{passed=$true;exe=$exe;title=$title;processId=$pidValue;dataDirectory=[System.IO.Path]::GetFullPath($DataDirectory);statePersisted=$true;gracefulExit=$true;windowAppearedSeconds=$windowAppearedSeconds;timingNote='Launch to first titled window; includes 1-second polling and process enumeration, not ready-to-interact or cold boot.';elapsedSeconds=[math]::Round(((Get-Date)-$started).TotalSeconds,1)}
  $result | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $Report
  $result | ConvertTo-Json
} finally {
  $env:ELECTRON_RUN_AS_NODE=$oldElectron
  $env:LITEBOX_DEV_URL=$oldDev
  $env:PORTABLE_EXECUTABLE_DIR=$oldPortable
}
