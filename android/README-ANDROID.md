# Building the CineVerse Android APK — no Gradle, no Android Studio

This folder contains the complete native Android project: a fullscreen WebView wrapper
around the CineVerse web app with a first-launch **server URL dialog**, a native
**DownloadManager**, fullscreen video support and a JS bridge (`window.CineVerseNative`).

- Package: `com.cineverse.app` — versionCode 1 — versionName 1.0.0
- minSdk 24 (Android 7.0) — targetSdk 34 (Android 14)
- Permissions: only `INTERNET` and `ACCESS_NETWORK_STATE`
- Signing: a local `debug.keystore` is generated automatically by `build.sh`
  (storepass/keypass `android`, alias `androiddebugkey`) — replace it with your own
  release key for production.

## Prerequisites

| Tool | Used for | Where to get it |
|---|---|---|
| JDK/JRE 8+ (`java` + `keytool`) | running ecj/d8, generating the keystore | any OpenJDK |
| Android cmdline-tools + `platforms;android-34` + `build-tools;34.0.0` | aapt2, d8, zipalign, apksigner | developer.android.com/studio → *Command line tools only* |
| Eclipse Compiler ecj 3.36 | compiling Java without `javac` | Maven Central (URL below) |

### One-command SDK setup (no Android Studio)

```bash
curl -L -o cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
unzip cmdtools.zip -d "$HOME/android-sdk"
yes | "$HOME/android-sdk/cmdline-tools/bin/sdkmanager" --sdk_root="$HOME/android-sdk" "platforms;android-34" "build-tools;34.0.0"
```

### Get the compiler

```bash
mkdir -p tools
curl -L -o tools/ecj.jar "https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.36.0/ecj-3.36.0.jar"
```

## Build

```bash
./build.sh
# → out/CineVerse.apk (aligned + signed, ready to install)
```

Custom paths: `SDK_ROOT=/opt/android-sdk ECJ_JAR=/path/ecj.jar ./build.sh`

### What `build.sh` actually does

1. `keytool -genkeypair` — create `debug.keystore` (only if missing)
2. `aapt2 compile` + `aapt2 link` — compile resources, build base APK, generate `R.java`
3. `ecj -8 -bootclasspath <android.jar>` — compile the Java sources
   > **Why `-bootclasspath`?** `android.jar` ships *stub* `java.*` classes. Without
   > `-bootclasspath`, modern JDKs resolve `java.lang` both from the `java.base` module and
   > from the classpath, and ecj fails with *"declaring package java.lang exported from module
   > java.base conflicts with a package accessible from module \<unnamed\>"*. Compiling with
   > `-8 -bootclasspath android.jar` uses the classic (pre-modules) resolution mode.
4. `d8 --release --min-api 24` — convert `.class` files to `classes.dex`
5. `zip` — add `classes.dex` into the APK
6. `zipalign 4`
7. `apksigner sign` + `apksigner verify`

## Install

```bash
adb install out/CineVerse.apk
# or copy the file to the phone and install manually
# (enable "install unknown apps" for your file manager/browser)
```

On first launch the app asks for the CineVerse server URL (wherever you host this web app)
and stores it in `SharedPreferences`. You can change it later inside the app:
Profile → «اتصال اپ اندروید» → *change server URL*.

## Structure

```
app/AndroidManifest.xml
app/java/com/cineverse/app/MainActivity.java   # WebView + NativeBridge + DownloadManager
app/res/mipmap-*/ic_launcher.png               # launcher icon in 5 densities
build.sh                                        # the whole toolchain in one script
gen-icons.mjs                                   # regenerate icons from SVG (sharp)
```
