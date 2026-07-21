$path = '.\index.html'
$text = [IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$text = $text -replace '\?v=v?[0-9\.]+', '?v=3.0.0'
$utf8NoBom = New-Object System.Text.UTF8Encoding $False
[IO.File]::WriteAllText($path, $text, $utf8NoBom)
