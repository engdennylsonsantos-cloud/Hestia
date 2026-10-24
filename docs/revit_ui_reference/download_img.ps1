$client = New-Object System.Net.WebClient
$client.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
$target = "<raiz-do-repositorio>\docs\revit_ui_reference\revit_2024_interface.png"
$url = "https://upload.wikimedia.org/wikipedia/commons/e/e7/Revit_2024.png"
try {
    $client.DownloadFile($url, $target)
    Write-Host "Downloaded successfully: $((Get-Item $target).Length) bytes"
} catch {
    Write-Host "Download failed: $_"
}
