$url = "https://medium.com/@designwithbim/autodesk-revit-user-interface-parts-of-the-interface-22a36b539cba"
try {
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -UserAgent "Mozilla/5.0"
    $regex = [regex]'https://miro.medium.com/v2/resize:fit:[^"''\s>]+'
    $matches = $regex.Matches($res.Content)
    $list = @()
    foreach ($m in $matches) {
        $list += $m.Value
    }
    $list | Select-Object -Unique | Set-Content -Path "<raiz-do-repositorio>\docs\revit_ui_reference\image_urls.txt"
    Write-Host "Found $($list.Count) URLs"
} catch {
    Write-Host "Error: $_"
}
