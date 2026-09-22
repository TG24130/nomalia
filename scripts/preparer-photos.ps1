# preparer-photos.ps1 — met les photos des bandeaux au format du web.
#
# Les photos sortent d'un appareil ou d'un telephone : plusieurs millions de
# pixels, parfois en PNG. Affichees sur une bande de 200 pixels de haut, elles
# feraient telecharger des megaoctets pour rien, et la PWA doit rester legere
# sur un reseau mobile.
#
# Le script redimensionne, reencode en JPEG et ecrit a cote sans toucher aux
# originaux. Utilise System.Drawing, present avec Windows : aucune
# installation n'est necessaire.
#
# Usage :
#   powershell -ExecutionPolicy Bypass -File scripts/preparer-photos.ps1
#
# Les fichiers traites sont ceux de images/ dont le nom comporte une double
# extension (accueil.jpg.jpg) ou une extension a corriger (.png) : ce sont les
# noms que donne Windows quand on renomme une image dans l'explorateur.

Add-Type -AssemblyName System.Drawing

$dossier = Join-Path $PSScriptRoot '..\images'
$dossier = (Resolve-Path $dossier).Path

# Largeur maximale. Au-dela, on telecharge des pixels que l'ecran n'affichera
# jamais : le bandeau le plus large fait 640 points, soit 1280 sur un ecran a
# densite doublee.
$largeurMax = 1400
$qualite = 82

# Un bandeau est une bande horizontale. Garder une photo verticale entiere
# ferait telecharger quatre fois les pixels affiches : on recadre donc a la
# source, sur un format large.
#
# Ancrage : ou se trouve, dans la hauteur de la photo, ce qu'il faut garder.
# 0 en haut, 1 en bas, 0,5 au milieu. Regle par photo, l'oeil decidant mieux
# que le centre geometrique.
$cadrages = @{
    # La plage : le soleil couchant et l'horizon sont aux deux tiers, sous le
    # palmier. Un peu plus haut que le milieu garde les deux.
    'accueil.jpg'        = @{ Ratio = 1.9; Ancrage = 0.58 }
    # La pyramide se tient dans le tiers superieur du cadre.
    'etape-tourisme.jpg' = @{ Ratio = 2.6; Ancrage = 0.34 }
    # Deja panoramique : rien a recadrer.
    'etape-randos.jpg'   = @{ Ratio = 2.2; Ancrage = 0.5 }
}
$cadrageParDefaut = @{ Ratio = 2.2; Ancrage = 0.5 }

# Bandes noires des captures video : une photo tiree d'une video en porte sur
# les cotes ou en haut et en bas. Les garder les ferait apparaitre dans le
# bandeau, ou elles se liraient comme un defaut d'affichage.
function SansBandesNoires($image) {
    $bitmap = New-Object System.Drawing.Bitmap($image)
    try {
        $milieuY = [int]($bitmap.Height / 2)
        $milieuX = [int]($bitmap.Width / 2)
        $seuil = 60  # somme des trois composantes : au-dessous, c'est du noir

        $gauche = 0
        while ($gauche -lt $bitmap.Width) {
            $c = $bitmap.GetPixel($gauche, $milieuY)
            if (($c.R + $c.G + $c.B) -gt $seuil) { break }
            $gauche++
        }

        $droite = $bitmap.Width - 1
        while ($droite -gt $gauche) {
            $c = $bitmap.GetPixel($droite, $milieuY)
            if (($c.R + $c.G + $c.B) -gt $seuil) { break }
            $droite--
        }

        $haut = 0
        while ($haut -lt $bitmap.Height) {
            $c = $bitmap.GetPixel($milieuX, $haut)
            if (($c.R + $c.G + $c.B) -gt $seuil) { break }
            $haut++
        }

        $bas = $bitmap.Height - 1
        while ($bas -gt $haut) {
            $c = $bitmap.GetPixel($milieuX, $bas)
            if (($c.R + $c.G + $c.B) -gt $seuil) { break }
            $bas--
        }

        # Les calculs passent par des variables : PowerShell prend une
        # expression dans New-Object pour un tableau d'arguments.
        $largeurUtile = $droite - $gauche + 1
        $hauteurUtile = $bas - $haut + 1
        return New-Object System.Drawing.Rectangle($gauche, $haut, $largeurUtile, $hauteurUtile)
    }
    finally {
        $bitmap.Dispose()
    }
}

function Convertir($source, $destination, $cadrage) {
    $image = [System.Drawing.Image]::FromFile($source)
    try {
        $utile = SansBandesNoires $image

        # Bande a prelever : toute la largeur utile, la hauteur qu'impose le
        # format demande.
        $hauteurUtile = [Math]::Min($utile.Height, [int]($utile.Width / $cadrage.Ratio))
        $haut = $utile.Y + [int](($utile.Height - $hauteurUtile) * $cadrage.Ancrage)
        $source_rect = New-Object System.Drawing.Rectangle(
            $utile.X, $haut, $utile.Width, $hauteurUtile)

        $ratio = [Math]::Min(1.0, $largeurMax / $utile.Width)
        $largeur = [int]($utile.Width * $ratio)
        $hauteur = [int]($hauteurUtile * $ratio)

        $cible = New-Object System.Drawing.Bitmap($largeur, $hauteur)
        $graphique = [System.Drawing.Graphics]::FromImage($cible)
        $graphique.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphique.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphique.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $destination_rect = New-Object System.Drawing.Rectangle(0, 0, $largeur, $hauteur)
        $graphique.DrawImage($image, $destination_rect, $source_rect,
            [System.Drawing.GraphicsUnit]::Pixel)

        $encodeur = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
            Where-Object { $_.MimeType -eq 'image/jpeg' }
        $parametres = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $parametres.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
            [System.Drawing.Imaging.Encoder]::Quality, [long]$qualite)

        $cible.Save($destination, $encodeur, $parametres)

        $graphique.Dispose()
        $cible.Dispose()

        return @{ Largeur = $largeur; Hauteur = $hauteur }
    }
    finally {
        $image.Dispose()
    }
}

# Nom final attendu : on retire les extensions surnumeraires laissees par
# l'explorateur Windows (accueil.jpg.jpg, etape-randos.jpg.png).
function NomFinal($nom) {
    $base = $nom
    while ($base -match '\.(jpg|jpeg|png)$') {
        $base = [System.IO.Path]::GetFileNameWithoutExtension($base)
    }
    return "$base.jpg"
}

$fichiers = Get-ChildItem -Path $dossier -File |
    Where-Object { $_.Extension -match '^\.(jpg|jpeg|png)$' }

foreach ($fichier in $fichiers) {
    $final = NomFinal $fichier.Name
    $destination = Join-Path $dossier $final

    $cadrage = if ($cadrages.ContainsKey($final)) { $cadrages[$final] } else { $cadrageParDefaut }

    # Un fichier deja au bon nom, deja leger et deja au bon format n'a rien a
    # gagner a etre reencode : chaque passage en JPEG degrade un peu l'image.
    $image = [System.Drawing.Image]::FromFile($fichier.FullName)
    $ratioActuel = $image.Width / $image.Height
    $image.Dispose()

    if ($fichier.Name -eq $final -and $fichier.Length -lt 260KB -and
        [Math]::Abs($ratioActuel - $cadrage.Ratio) -lt 0.35) {
        Write-Output "$($fichier.Name) : deja pret, laisse tel quel"
        continue
    }

    $temporaire = "$destination.tmp"
    $avant = [Math]::Round($fichier.Length / 1KB)

    # L'original n'est supprime qu'une fois la conversion reussie et verifiee.
    # L'inverse a deja efface trois photos que le script n'avait pas su
    # convertir : il ne reste alors plus rien a reprendre.
    try {
        $taille = Convertir $fichier.FullName $temporaire $cadrage
    }
    catch {
        Write-Warning "$($fichier.Name) : conversion impossible, fichier laisse intact. $_"
        if (Test-Path $temporaire) { Remove-Item $temporaire -Force }
        continue
    }

    if (-not (Test-Path $temporaire) -or (Get-Item $temporaire).Length -lt 1KB) {
        Write-Warning "$($fichier.Name) : conversion vide, fichier laisse intact."
        if (Test-Path $temporaire) { Remove-Item $temporaire -Force }
        continue
    }

    Remove-Item $fichier.FullName -Force
    if (Test-Path $destination) { Remove-Item $destination -Force }
    Move-Item $temporaire $destination

    $apres = [Math]::Round((Get-Item $destination).Length / 1KB)
    Write-Output "$($fichier.Name) -> $final : $($taille.Largeur)x$($taille.Hauteur), $avant ko -> $apres ko"
}
