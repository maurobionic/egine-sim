#!/bin/bash
# Dê dois cliques neste arquivo no Mac (Finder) para abrir o simulador.
cd "$(dirname "$0")"
PORT=8080
if command -v node >/dev/null 2>&1; then
  (sleep 1 && open "http://localhost:$PORT") &
  node server.mjs
elif command -v python3 >/dev/null 2>&1; then
  (sleep 1 && open "http://localhost:$PORT") &
  python3 -m http.server $PORT --bind 127.0.0.1
else
  echo "Instale o Node.js (https://nodejs.org) ou o Python 3 para rodar o simulador."
  read -r -p "Pressione Enter para sair"
fi
