class SCLSyntaxChecker {
    [string]$FilePath
    [System.Collections.ArrayList]$Violations
    [System.Collections.ArrayList]$Variables
    [int]$TotalChecks
    
    SCLSyntaxChecker([string]$path) {
        $this.FilePath = $path
        $this.Violations = New-Object System.Collections.ArrayList
        $this.Variables = New-Object System.Collections.ArrayList
        $this.TotalChecks = 0
    }

    [void] AnalyzeFile() {
        $content = Get-Content -Path $this.FilePath -Raw
        
        # Extrahiere alle Variablendeklarationen
        $varBlocks = @('VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR', 'VAR_TEMP')
        foreach ($block in $varBlocks) {
            $pattern = "(?s)$block\b(.*?)END_VAR"
            if ($content -match $pattern) {
                $blockContent = $matches[1]
                $varLines = $blockContent -split "`n" | Where-Object { $_ -match '^\s*(\w+)\s*:' }
                foreach ($line in $varLines) {
                    if ($line -match '^\s*(\w+)\s*:') {
                        $this.Variables.Add($matches[1]) | Out-Null
                    }
                }
            }
        }

        # Extrahiere den Code-Bereich
        if ($content -match '(?s)BEGIN(.*?)END_FUNCTION_BLOCK') {
            $codeSection = $matches[1]
            $lineNum = 0
            $lines = $codeSection -split "`n"
            
            foreach ($var in $this.Variables) {
                $this.TotalChecks++
                # Suche nach Verwendungen ohne #-Präfix
                $pattern = "(?<![\w#])$var(?![\w])"
                $lineNum = 0
                foreach ($line in $lines) {
                    $lineNum++
                    if ($line -match $pattern) {
                        $violation = @{
                            Variable = $var
                            Line = $lineNum
                            Context = $line.Trim()
                            Suggestion = $line.Trim() -replace "(?<!#)$var", "#$var"
                        }
                        $this.Violations.Add($violation) | Out-Null
                    }
                }
            }
        }
    }

    [void] Fix() {
        if ($this.Violations.Count -eq 0) {
            return
        }

        $content = Get-Content -Path $this.FilePath -Raw
        $newContent = $content

        # Backup erstellen
        $backup = "$($this.FilePath).bak"
        Copy-Item -Path $this.FilePath -Destination $backup -Force

        foreach ($violation in $this.Violations) {
            $var = $violation.Variable
            # Ersetze Variable mit #-Präfix, aber nur im Code-Bereich
            $pattern = "(?<![\w#])($var)(?![\w])"
            $newContent = $newContent -replace $pattern, '#$1'
        }

        Set-Content -Path $this.FilePath -Value $newContent -Force
    }

    [string] GenerateReport() {
        $report = "SCL Syntax Check Bericht`n"
        $report += "=====================`n`n"
        $report += "Datei: $($this.FilePath)`n"
        $report += "Geprüfte Variablen: $($this.Variables.Count)`n"
        $report += "Durchgeführte Prüfungen: $($this.TotalChecks)`n"
        $report += "Gefundene Verstöße: $($this.Violations.Count)`n`n"

        if ($this.Violations.Count -gt 0) {
            $report += "Detaillierte Verstöße:`n"
            $report += "------------------`n"
            foreach ($v in $this.Violations) {
                $report += "Zeile $($v.Line): Variable '$($v.Variable)' ohne #-Präfix`n"
                $report += "Kontext: $($v.Context)`n"
                $report += "Vorschlag: $($v.Suggestion)`n`n"
            }
        } else {
            $report += "Keine Syntaxverstöße gefunden.`n"
        }

        return $report
    }
}

# Parameter verarbeiten
param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    [switch]$Fix
)

# Hauptprogramm
try {
    $checker = [SCLSyntaxChecker]::new($FilePath)
    $checker.AnalyzeFile()
    
    Write-Host $checker.GenerateReport()
    
    if ($Fix) {
        $checker.Fix()
        Write-Host "`nAutomatische Korrekturen wurden angewendet.`n"
    }
    
    exit $checker.Violations.Count
} catch {
    Write-Error $_.Exception.Message
    exit 1
}