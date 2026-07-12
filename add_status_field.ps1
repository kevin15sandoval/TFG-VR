# Script PowerShell para agregar campo status via REST API
$url = "https://firestore.googleapis.com/v1/projects/tfg-vr/databases/(default)/documents/sesion_activa/current?updateMask.fieldPaths=status"

$body = @{
    fields = @{
        status = @{
            stringValue = "pending"
        }
    }
} | ConvertTo-Json -Depth 10

Write-Host "Agregando campo status=pending a sesion activa..."
Write-Host "URL: $url"

$response = Invoke-RestMethod -Uri $url -Method PATCH -Body $body -ContentType "application/json"

Write-Host "Campo status agregado correctamente"
Write-Host "Respuesta:"
$response | ConvertTo-Json -Depth 5
