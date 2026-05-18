$path = '.\templates\calcs\wall_4split.html'
$text = [IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$text = $text -replace '\?v=2\.6\.11', '?v=2.6.12'
$utf8NoBom = New-Object System.Text.UTF8Encoding $False
[IO.File]::WriteAllText($path, $text, $utf8NoBom)
