Param(
    [Parameter(Mandatory=$true)]
    [string]$File
)

Get-Content -Path $File | Select-String -Pattern 'dummyBool' | ForEach-Object {
    "{0}: {1}" -f $_.LineNumber, $_.Line
}
