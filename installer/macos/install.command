#!/bin/bash
set -euo pipefail

extension_id="ofkaofkclbhlbgfbmfnpdihgpcpofjkg"
bundle_dir="$(cd "$(dirname "$0")" && pwd)"
install_dir="$HOME/.window-codex/native-host"
launcher="$HOME/.window-codex/native-host.sh"
manifest_dir="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

node_bin="$(command -v node || true)"
codex_bin="$(command -v codex || true)"
if [ -z "$node_bin" ] || [ -z "$codex_bin" ]; then
  echo "window.codex requires Node.js and an installed Codex CLI."
  echo "Install both, authenticate Codex, then run this installer again."
  read -r -p "Press return to close…"
  exit 1
fi

mkdir -p "$install_dir" "$manifest_dir"
cp -R "$bundle_dir/bridge/." "$install_dir/"
printf -v quoted_node '%q' "$node_bin"
printf -v quoted_codex '%q' "$codex_bin"
printf -v quoted_entry '%q' "$install_dir/index.js"
{
  echo '#!/bin/bash'
  printf 'export WINDOW_CODEX_CODEX_BIN=%s\n' "$quoted_codex"
  printf 'exec %s %s\n' "$quoted_node" "$quoted_entry"
} > "$launcher"
chmod 755 "$launcher"

cat > "$manifest_dir/com.window.codex.json" <<EOF
{
  "name": "com.window.codex",
  "description": "Local Codex bridge for window.codex",
  "path": "$launcher",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$extension_id/"]
}
EOF

echo "window.codex bridge installed."
echo "Return to Chrome and click Check connection."
read -r -p "Press return to close…"
