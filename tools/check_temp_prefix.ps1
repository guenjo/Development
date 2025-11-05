Param(
    [Parameter(Mandatory=$false)]
    [string]$FilePath = "./Programmbausteine/Development/Template_StateMachine.scl",
    [switch]$Fix,
    [switch]$PrintDecls,
    [string]$Prefix = "temp"
)

try {
    $absPath = Resolve-Path -Path $FilePath -ErrorAction Stop
} catch {
    Write-Error "File not found: $FilePath"
    exit 2
}

$content = Get-Content -Path $absPath -Raw -ErrorAction Stop
 # Extract VAR_TEMP blocks using singleline regex (robust against encoding/line-splitting)
 $violations = @()
 $varDecls = @()
 $pattern = '(?si)VAR_TEMP\b(.*?)END_VAR\b'
 $matches = [regex]::Matches($content, $pattern)
 if ($matches.Count -eq 0) {
     # no VAR_TEMP blocks found
     Write-Output "No VAR_TEMP block found in file."
     exit 0
 }

 foreach ($m in $matches) {
     $block = $m.Groups[1].Value
     # split block into lines to capture line numbers approximately
     $blockLines = $block -split "`r?`n"
     for ($j=0; $j -lt $blockLines.Count; $j++) {
         $lineText = $blockLines[$j]
         $trim = $lineText.Trim()
         if ($trim -eq '' -or $trim.StartsWith('//') -or $trim.StartsWith('(*')) { continue }
         $decls = [regex]::Matches($lineText, '([A-Za-z_][A-Za-z0-9_]*)\s*:')
         foreach ($d in $decls) {
             $name = $d.Groups[1].Value
             $varDecls += [pscustomobject]@{Name=$name; Line=$null}
             if (-not $name.StartsWith($Prefix)) {
                 $suggest = $Prefix + ($name.Substring(0,1).ToUpper() + $name.Substring(1))
                 $violations += [pscustomobject]@{Name=$name; Line=$null; Suggested=$suggest}
             }
         }
     }
 }

if ($violations.Count -eq 0) {
    Write-Output "No violations found. All VAR_TEMP variables start with '$Prefix'."
    if ($PrintDecls) {
        Write-Output "Declarations found in VAR_TEMP:"
        foreach ($d in $varDecls) { Write-Output (" - {0} (line {1})" -f $d.Name,$d.Line) }
    }
    exit 0
} else {
    Write-Output "Found $($violations.Count) violation(s):"
    foreach ($v in $violations) {
        Write-Output (" - {0} (line {1}) -> suggested: {2}" -f $v.Name, $v.Line, $v.Suggested)
    }

    if ($Fix) {
        $backup = "$absPath.bak"
        Copy-Item -Path $absPath -Destination $backup -Force
        $newContent = $content

        foreach ($v in $violations) {
            $old = [Regex]::Escape($v.Name)
            $new = $v.Suggested
            # Replace occurrences preserving optional leading '#'
            $pattern = "(?<![A-Za-z0-9_])(#?)" + $old + "(?![A-Za-z0-9_])"
            $newContent = [Regex]::Replace($newContent, $pattern, '$1' + $new)
        }

        Set-Content -Path $absPath -Value $newContent -Force
        Write-Output "Applied fixes. Backup saved as: $backup"
        exit 0
    }

    exit 1
}
