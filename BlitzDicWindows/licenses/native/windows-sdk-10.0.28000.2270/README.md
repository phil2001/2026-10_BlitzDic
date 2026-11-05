# Windows SDK redistributable: D3DCompiler 47

The Electron-supplied `d3dcompiler_47.dll` matches
`c/Redist/D3D/x64/d3dcompiler_47.dll` in Microsoft's stable
`Microsoft.Windows.SDK.CPP` 10.0.28000.2270 package byte for byte.
The SDK package matched NuGet's independently published SHA-512 value.
The DLL's Microsoft Authenticode signature was valid. Package URLs, hashes,
the original package descriptor and the catalog response are retained here.
The SDK packages themselves remain development inputs in `.runtime`.

The package descriptor points to `https://aka.ms/WinSDKLicenseURL` and requires
license acceptance. That URL supplied the unmodified `SDK-LICENSE.rtf` retained
here. `SDK-LICENSE.txt` was generated with Windows RichEdit's plain-text
conversion; the original RTF remains authoritative. The Windows build verifies
both hashes and identifies these terms separately from the MIT application
and Visual C++ V14 terms on the installer license page.

Microsoft's SDK terms permit copying the listed distributable object code
with one's Windows programs subject to their conditions. The published
REDIST list specifically includes this DLL for Classic Windows applications.
BlitzDic's NSIS desktop output fits that application category. The SDK's
publisher obligations, including copyright retention, end-user protection,
distribution restrictions and indemnification, continue to apply. The free
SDK acquisition is separate from the Visual Studio Community agreement.
Using the SDK software constitutes acceptance under its original terms;
there is no separate paid SDK product key in this licensing route.

The requested project now retains the official SDK package as its development
source and includes the original component's terms with the unmodified DLL.
No system-wide SDK installation was performed. Ordination workstations receive
the DLL with BlitzDic and need no separate SDK or development-tool installation.
This record documents the concrete code and terms; it is not a Microsoft-issued
certificate or a guarantee about every publisher's circumstances.

[Official package](https://www.nuget.org/packages/Microsoft.Windows.SDK.CPP/10.0.28000.2270)
· [SDK terms](https://learn.microsoft.com/en-us/legal/windows-sdk/license)
· [SDK REDIST list](https://learn.microsoft.com/en-us/legal/windows-sdk/redist)
