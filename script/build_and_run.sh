#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="PraxisDemoHostApp"
BUNDLE_ID="dev.praxis.PraxisDemoHostApp"
MIN_SYSTEM_VERSION="14.0"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_BINARY="$APP_MACOS/$APP_NAME"
INFO_PLIST="$APP_CONTENTS/Info.plist"

kill_existing_app() {
  if pgrep -x "$APP_NAME" >/dev/null 2>&1; then
    pkill -x "$APP_NAME" >/dev/null 2>&1 || true

    for _ in {1..20}; do
      if ! pgrep -x "$APP_NAME" >/dev/null 2>&1; then
        break
      fi
      sleep 0.2
    done
  fi
}

build_app() {
  (
    cd "$ROOT_DIR"
    swift build --product "$APP_NAME"
    local build_binary
    build_binary="$(swift build --show-bin-path)/$APP_NAME"

    if [[ ! -x "$build_binary" ]]; then
      echo "Built binary not found at $build_binary" >&2
      exit 1
    fi

    rm -rf "$APP_BUNDLE"
    mkdir -p "$APP_MACOS"
    cp "$build_binary" "$APP_BINARY"
    chmod +x "$APP_BINARY"

    cat >"$INFO_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>$MIN_SYSTEM_VERSION</string>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
PLIST
  )
}

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

verify_process() {
  for _ in {1..20}; do
    if pgrep -x "$APP_NAME" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done

  echo "Process verification failed for $APP_NAME" >&2
  return 1
}

stream_logs() {
  /usr/bin/log stream --info --style compact --predicate "process == \"$APP_NAME\""
}

stream_telemetry() {
  /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
}

usage() {
  echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
}

kill_existing_app
build_app

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    lldb -- "$APP_BINARY"
    ;;
  --logs|logs)
    open_app
    stream_logs
    ;;
  --telemetry|telemetry)
    open_app
    stream_telemetry
    ;;
  --verify|verify)
    open_app
    verify_process
    ;;
  *)
    usage
    exit 2
    ;;
esac
