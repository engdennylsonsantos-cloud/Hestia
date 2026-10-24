$url = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Revit_2024.png/1280px-Revit_2024.png"
$dest = "<raiz-do-repositorio>\docs\revit_ui_reference\revit_2024_interface.png"

$handler = New-Object System.Net.Http.HttpClientHandler
$client = New-Object System.Net.Http.HttpClient($handler)
$client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
$client.DefaultRequestHeaders.Add("Referer", "https://commons.wikimedia.org/wiki/File:Revit_2024.png")

try {
    $bytes = $client.GetByteArrayAsync($url).GetAwaiter().GetResult()
    [System.IO.File]::WriteAllBytes($dest, $bytes)
    Write-Host "Success: downloaded $($bytes.Length) bytes to $dest"
} catch {
    Write-Host "Error: $_"
}
