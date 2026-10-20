#!/bin/bash
#
# CineVerse — native Android APK build (no Gradle, no Android Studio)
# Toolchain: aapt2 (compile/link) → ecj (javac-compatible) → d8 (dex)
#            → zip → zipalign → apksigner
#
# Prerequisites:
#   1. java + keytool on PATH (any JDK/JRE 8+)
#   2. Android SDK with platforms;android-34 and build-tools;34.0.0
#      Install without Android Studio:
#        curl -L -o cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
#        unzip cmdtools.zip -d "$HOME/android-sdk"
#        yes | "$HOME/android-sdk/cmdline-tools/bin/sdkmanager" --sdk_root="$HOME/android-sdk" "platforms;android-34" "build-tools;34.0.0"
#   3. Eclipse Compiler ecj (default: tools/ecj.jar)
#        curl -L -o ecj.jar "https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.36.0/ecj-3.36.0.jar"
#
# Usage:
#   ./build.sh                          # uses defaults below
#   SDK_ROOT=/path ECJ_JAR=/path ./build.sh
#
set -euo pipefail

# ———— Configuration (override via environment) ————————————————————————————
SDK_ROOT="${SDK_ROOT:-$HOME/android-sdk}"
ECJ_JAR="${ECJ_JAR:-$(dirname "$0")/tools/ecj.jar}"
BUILD_TOOLS="${BUILD_TOOLS:-34.0.0}"
PLATFORM="${PLATFORM:-android-34}"

BT="$SDK_ROOT/build-tools/$BUILD_TOOLS"
PLATFORM_JAR="$SDK_ROOT/platforms/$PLATFORM/android.jar"
APP_DIR="$(cd "$(dirname "$0")" && pwd)/app"
OUT="$(cd "$(dirname "$0")" && pwd)/out"
KS="$(dirname "$0")/debug.keystore"

command -v java >/dev/null || { echo "ERROR: java not found on PATH"; exit 1; }
[ -x "$BT/aapt2" ] || { echo "ERROR: aapt2 not found at $BT — check SDK_ROOT/BUILD_TOOLS"; exit 1; }
[ -f "$PLATFORM_JAR" ] || { echo "ERROR: $PLATFORM_JAR missing — install platforms;$PLATFORM"; exit 1; }
[ -f "$ECJ_JAR" ] || { echo "ERROR: ecj.jar not found at $ECJ_JAR — download it (see header) or set ECJ_JAR"; exit 1; }

mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"
cd "$(dirname "$0")"

echo "== 1/9 keystore =="
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass android -keypass android \
    -alias androiddebugkey -dname "CN=CineVerse Debug,O=CineVerse,C=IR" \
    -keyalg RSA -keysize 2048 -validity 10000 2>&1 | tail -1
else
  echo "using existing $KS"
fi

echo "== 2/9 aapt2 compile =="
"$BT/aapt2" compile --dir "$APP_DIR/res" -o "$OUT/res.zip"

echo "== 3/9 aapt2 link =="
"$BT/aapt2" link -o "$OUT/unsigned.apk" \
  -I "$PLATFORM_JAR" \
  --manifest "$APP_DIR/AndroidManifest.xml" \
  -R "$OUT/res.zip" \
  --java "$OUT/gen" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code 1 --version-name 1.0.0

echo "== 4/9 ecj compile =="
# NOTE: android.jar ships stub java.* classes; -bootclasspath prevents the
#       "java.base module conflicts with classpath" error on modern JDKs.
java -jar "$ECJ_JAR" -8 -encoding UTF-8 -nowarn \
  -bootclasspath "$PLATFORM_JAR" \
  -d "$OUT/classes" \
  "$APP_DIR/java/com/cineverse/app/MainActivity.java" \
  "$OUT/gen/com/cineverse/app/R.java"

echo "== 5/9 d8 dex =="
CLASSFILES=$(find "$OUT/classes" -name '*.class')
"$BT/d8" --release --lib "$PLATFORM_JAR" --min-api 24 --output "$OUT/dex" $CLASSFILES

echo "== 6/9 package dex =="
cp "$OUT/unsigned.apk" "$OUT/base.apk"
( cd "$OUT/dex" && zip -j -q "$OUT/base.apk" classes.dex )

echo "== 7/9 zipalign =="
"$BT/zipalign" -f 4 "$OUT/base.apk" "$OUT/aligned.apk"

echo "== 8/9 sign =="
"$BT/apksigner" sign \
  --ks "$KS" --ks-pass pass:android --key-pass pass:android \
  --ks-key-alias androiddebugkey \
  --out "$OUT/CineVerse.apk" "$OUT/aligned.apk"

echo "== 9/9 verify =="
"$BT/apksigner" verify "$OUT/CineVerse.apk" && echo "signature OK"
ls -la "$OUT/CineVerse.apk"
echo "BUILD DONE → out/CineVerse.apk"
