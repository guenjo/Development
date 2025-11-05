Param(
    [Parameter(Mandatory=$false)]
    [string]$FilePath = "./Programmbausteine/Development/Template_Simple.scl",
    [switch]$Fix
)

try {
    $absPath = Resolve-Path -Path $FilePath -ErrorAction Stop
} catch {
    Write-Error "File not found: $FilePath"
    exit 2
}

$content = Get-Content -Path $absPath -Raw -ErrorAction Stop

# Funktion zum Extrahieren aller Variablennamen aus den Deklarationsbereichen
function Get-DeclaredVariables {
    param (
        [string]$content
    )
    
    $variables = @()
    $varBlocks = @('VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR', 'VAR_TEMP')
    
    foreach ($block in $varBlocks) {
        $pattern = "(?s)$block\b(.*?)END_VAR"
        if ($content -match $pattern) {
            $blockContent = $matches[1]
            # Extrahiere Variablennamen (ohne Kommentare und Attribute)
            $varLines = $blockContent -split "`n" | Where-Object { $_ -match '^\s*(\w+)\s*:' }
            foreach ($line in $varLines) {
                if ($line -match '^\s*(\w+)\s*:') {
                    $variables += $matches[1]
                }
            }
        }
    }
    
    return $variables
}

# Extrahiere den Code-Bereich (nach BEGIN bis END_FUNCTION_BLOCK)
if ($content -match '(?s)BEGIN(.*?)END_FUNCTION_BLOCK') {
    $codeSection = $matches[1]
    
    # Hole alle deklarierten Variablen
    $declaredVars = Get-DeclaredVariables -content $content
    
    # Suche nach Verwendungen ohne #-Präfix
    $violations = @()
    foreach ($var in $declaredVars) {
        # Suche nach Verwendungen der Variable ohne #-Präfix
        # Berücksichtige nur eigenständige Wörter (keine Teilstrings)
        $pattern = "(?<![\w#])$var(?![\w])"
        if ($codeSection -match $pattern) {
            # Extrahiere Kontext für bessere Fehlermeldung
            $lineNum = 0
            $lines = $codeSection -split "`n"
            foreach ($line in $lines) {
                $lineNum++
                if ($line -match $pattern) {
                    $violations += [PSCustomObject]@{
                        Variable = $var
                        Line = $lineNum
                        Context = $line.Trim()
                    }
                }
            }
        }
    }
    
    # Ausgabe der Ergebnisse
    if ($violations.Count -eq 0) {
        Write-Host "Keine Verstöße gefunden. Alle Variablen werden korrekt mit '#' verwendet."
    } else {
        Write-Host "Gefunden: $($violations.Count) Verstöße gegen die #-Präfix Regel:"
        foreach ($v in $violations) {
            Write-Host "Variable '$($v.Variable)' in Zeile $($v.Line) ohne #-Präfix:"
            Write-Host "  $($v.Context)"
        }
        
        if ($Fix) {
            $newContent = $content
            foreach ($var in $declaredVars) {
                # Ersetze Variablenverwendungen mit #-Präfix
                $pattern = "(?<![\w#])($var)(?![\w])"
                $newContent = $newContent -replace $pattern, '#$1'
            }
            
            # Backup erstellen und Änderungen speichern
            $backup = "$absPath.bak"
            Copy-Item -Path $absPath -Destination $backup -Force
            Set-Content -Path $absPath -Value $newContent -Force
            Write-Host "Korrekturen wurden angewendet. Backup gespeichert als: $backup"
        } else {
            exit 1
        }
    }
} else {
    Write-Error "Konnte den Code-Bereich nicht finden (BEGIN bis END_FUNCTION_BLOCK)"
    exit 3
}