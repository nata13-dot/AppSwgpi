#!/usr/bin/env bash
# Compila, firma y publica una versión nueva de la app Android.
#   npm run release:android -- -m "Novedades para el usuario" [--obligatoria] [--no-bump] [--no-publish]
# - Sube versionCode en 1 y el último número de versionName (1.1.59-beta -> 1.1.60-beta), salvo --no-bump.
# - Copia el APK a ~/Documentos/SGPI-<versión>.apk.
# - Lo publica en la API con la llave de ~/.config/sgpi/release-token (php artisan sgpi:release-token).
#   Sin llave, sólo compila y avisa que hay que subirlo en /versiones-app.
set -euo pipefail
cd "$(dirname "$0")/.."

NOTES=""; MANDATORY=0; BUMP=1; PUBLISH=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--notas) NOTES="$2"; shift 2 ;;
    --obligatoria) MANDATORY=1; shift ;;
    --no-bump) BUMP=0; shift ;;
    --no-publish) PUBLISH=0; shift ;;
    *) echo "Opción desconocida: $1" >&2; exit 2 ;;
  esac
done

GRADLE=android/app/build.gradle
API_URL="${SGPI_API_URL:-https://api.swgpi.online/api}"
TOKEN_FILE="${SGPI_RELEASE_TOKEN_FILE:-$HOME/.config/sgpi/release-token}"
export JAVA_HOME="${JAVA_HOME:-$HOME/.jdks/jdk-21.0.13+9}"

code=$(grep -oP 'versionCode \K[0-9]+' "$GRADLE")
name=$(grep -oP 'versionName "\K[^"]+' "$GRADLE")
if [[ $BUMP -eq 1 ]]; then
  code=$((code + 1))
  # Sube el último número antes del sufijo: 1.1.59-beta -> 1.1.60-beta
  name=$(python3 -c 'import re,sys; n=sys.argv[1]; m=re.match(r"^(.*?)(\d+)([^\d]*)$", n); print(f"{m[1]}{int(m[2])+1}{m[3]}" if m else n)' "$name")
  sed -i -E "s/versionCode [0-9]+/versionCode $code/; s/versionName \"[^\"]+\"/versionName \"$name\"/" "$GRADLE"
fi
echo "==> Versión $name ($code)"

npx vite build >/dev/null 2>&1 || { echo "Falló la compilación web." >&2; exit 1; }
npx cap sync android >/dev/null 2>&1 || { echo "Falló cap sync." >&2; exit 1; }
(cd android && ./gradlew assembleRelease -q 2>&1 | grep -v "SDK XML" || true)
APK=android/app/build/outputs/apk/release/app-release.apk
[[ -f "$APK" ]] || { echo "No se generó el APK." >&2; exit 1; }
OUT="$HOME/Documentos/SGPI-$name.apk"
cp "$APK" "$OUT"
echo "==> APK: $OUT ($(du -h "$OUT" | cut -f1))"

if [[ $PUBLISH -eq 0 ]]; then echo "==> Sin publicar (--no-publish)."; exit 0; fi
if [[ ! -s "$TOKEN_FILE" ]]; then
  echo "==> No hay llave de publicación en $TOKEN_FILE: súbelo a mano en /versiones-app (número $code, nombre $name)."
  exit 0
fi
[[ -n "$NOTES" ]] || NOTES=$(git log -1 --pretty=%s)

# La llave viaja sólo en el encabezado; no se imprime.
response=$(curl -sS --max-time 300 -w '\n%{http_code}' \
  -H "Accept: application/json" \
  -H "X-SGPI-Release-Token: $(tr -d '[:space:]' < "$TOKEN_FILE")" \
  -F "apk=@$OUT;type=application/vnd.android.package-archive" \
  -F "version_code=$code" -F "version_name=$name" -F "notas=$NOTES" -F "obligatoria=$MANDATORY" \
  "$API_URL/app/publish")
status=$(tail -n1 <<< "$response"); body=$(sed '$d' <<< "$response")
if [[ "$status" == "201" ]]; then
  echo "==> Publicada: $(python3 -c 'import json,sys; print(json.load(sys.stdin).get("message",""))' <<< "$body")"
else
  echo "==> No se pudo publicar (HTTP $status): $body" >&2
  exit 1
fi
