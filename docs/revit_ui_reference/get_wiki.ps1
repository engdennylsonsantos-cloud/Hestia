$url = "https://commons.wikimedia.org/wiki/File:Revit_2024.png"
$userAgent = "HestiaResearch/1.0 (contato@example.com)"
$res = Invoke-WebRequest -Uri $url -UseBasicParsing -UserAgent $userAgent
$regex = [regex]'https://upload\.wikimedia\.org/wikipedia/commons/[^"''\s><]+'
$matches = $regex.Matches($res.Content)
$urls = @()
foreach ($m in $matches) {
    if ($m.Value -match '\.(png|jpg|jpeg)$') {
        $urls += $m.Value
    }
}
$urls | Select-Object -Unique | Set-Content -Path "<raiz-do-repositorio>\docs\revit_ui_reference\wiki_urls.txt"
Get-Content "<raiz-do-repositorio>\docs\revit_ui_reference\wiki_urls.txt"
