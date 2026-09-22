# generer-icones.ps1 — produit les icônes de la PWA à partir du logo source.
#
# Usage : powershell -ExecutionPolicy Bypass -File scripts/generer-icones.ps1
#
# Le logo source vit dans icons/logo-source.png. Relancer ce script après
# l'avoir remplacé suffit à régénérer toutes les tailles.
#
# L'icône « maskable » réserve une marge autour du logo : selon le téléphone,
# le système rogne l'icône en cercle, en goutte ou en carré arrondi, et sans
# cette marge le logo serait amputé.

Add-Type -AssemblyName System.Drawing

$racine = Split-Path -Parent $PSScriptRoot
$source = Join-Path $racine "icons\logo-source.png"
$dossier = Join-Path $racine "icons"

if (-not (Test-Path $source)) {
    Write-Error "Logo source introuvable : $source"
    exit 1
}

# Fond des icônes : le logo est sur blanc, garder du blanc évite un liseré.
$fond = [System.Drawing.Color]::White

function Ecrire-Icone {
    param(
        [int]$Taille,
        [double]$Proportion,
        [string]$Nom
    )

    $original = [System.Drawing.Image]::FromFile($source)
    $cible = New-Object System.Drawing.Bitmap($Taille, $Taille)
    $g = [System.Drawing.Graphics]::FromImage($cible)

    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($fond)

    $interieur = [int]($Taille * $Proportion)
    $marge = [int](($Taille - $interieur) / 2)
    $g.DrawImage($original, $marge, $marge, $interieur, $interieur)

    $chemin = Join-Path $dossier $Nom
    $cible.Save($chemin, [System.Drawing.Imaging.ImageFormat]::Png)

    $poids = [math]::Round((Get-Item $chemin).Length / 1KB)
    Write-Output "$Nom — $($Taille)x$($Taille) — $poids Ko"

    $g.Dispose(); $cible.Dispose(); $original.Dispose()
}

Ecrire-Icone -Taille 192 -Proportion 1.0 -Nom "icone-192.png"
Ecrire-Icone -Taille 512 -Proportion 1.0 -Nom "icone-512.png"
Ecrire-Icone -Taille 180 -Proportion 1.0 -Nom "icone-apple-180.png"
Ecrire-Icone -Taille 32 -Proportion 1.0 -Nom "favicon-32.png"

# Zone sûre d'une icône maskable : 80 % du côté, centrés.
Ecrire-Icone -Taille 512 -Proportion 0.78 -Nom "icone-maskable-512.png"
