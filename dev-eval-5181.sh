#!/usr/bin/env bash
# Dev stack launcher — port 5181 for vite (5174 is taken by OpenDesk)
set -Eeuo pipefail

# Load NVM (cron / non-interactive subshells don't get it from .zshrc)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Kill anything lingering on our ports
lsof -ti:3001 2>/dev/null | xargs -I{} kill -9 {} 2>/dev/null || true
lsof -ti:5181 2>/dev/null | xargs -I{} kill -9 {} 2>/dev/null || true

# Emit env file (avoid shell $VAR word-split bug for values with spaces)
node -e "
const fs=require('fs');
function parseLine(line){
  const hashIdx=line.indexOf('#');
  if(hashIdx>=0){let inS=false,inD=false;for(let i=0;i<hashIdx;i++){if(line[i]===\"'\"&&!inD)inS=!inS;if(line[i]=='\"'&&!inS)inD=!inD;}if(!inS&&!inD)line=line.slice(0,hashIdx);}
  line=line.trim();if(!line)return null;const eq=line.indexOf('=');if(eq<0)return null;const k=line.slice(0,eq).trim();let v=line.slice(eq+1).trim();if((v.startsWith('\"')&&v.endsWith('\"'))||(v.startsWith(\"'\")&&v.endsWith(\"'\")))v=v.slice(1,-1);return[k,v];
}
const out={};
for(const f of ['/Users/fangchen/Baidu/GitHub/openhackathon/.env','/Users/fangchen/Baidu/GitHub/openhackathon/.env.example']){
  if(!fs.existsSync(f))continue;
  for(const line of fs.readFileSync(f,'utf8').split(/\r?\n/)){const kv=parseLine(line);if(kv)out[kv[0]]=kv[1];}
}
out.PORT='3001';
out.VITE_APP_URL='http://localhost:5181';
out.CORS_ORIGINS='http://localhost:5181,http://localhost:5173';
out.VITE_API_PROXY_URL='http://localhost:3001';
fs.writeFileSync('/tmp/openhackathon-env-5181.sh', Object.entries(out).map(([k,v])=>'export '+k+'='+JSON.stringify(v)).join('\n')+'\n');
console.log('[dev-eval-5181] wrote', Object.keys(out).length, 'env vars');
"

# shellcheck disable=SC1091
source /tmp/openhackathon-env-5181.sh

echo "[dev-eval-5181] API_PORT=$PORT  VITE_PORT=5181  VITE_APP_URL=$VITE_APP_URL"

# Run server + client concurrently
exec npx concurrently -k -n api,web -c blue,green \
  "npx tsx api/index.ts" \
  "npx vite --port 5181 --strictPort --host 127.0.0.1"
