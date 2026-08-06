#!/usr/bin/env bash
# Dev stack launcher — emits `export K=V` lines then evals them, then starts
# api on 3001 + vite on 5174.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Kill anything lingering
lsof -ti:3001 2>/dev/null | xargs -I{} kill -9 {} 2>/dev/null || true
lsof -ti:5174 2>/dev/null | xargs -I{} kill -9 {} 2>/dev/null || true

# Print env to stdout as `export K=V` so caller can `eval` it
node /tmp/load-env.js 1>/dev/null  # warm up so process.env is set in this process tree only — won't help children

# Better: emit a `env` file from node
node -e "
const fs=require('fs');
const {execSync}=require('child_process');
// Re-parse + emit
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
out.VITE_APP_URL='http://localhost:5174';
out.CORS_ORIGINS='http://localhost:5174,http://localhost:5173';
fs.writeFileSync('/tmp/openhackathon-env.sh', Object.entries(out).map(([k,v])=>'export '+k+'='+JSON.stringify(v)).join('\n')+'\n');
console.log('[dev-eval] wrote', Object.keys(out).length, 'env vars to /tmp/openhackathon-env.sh');
"

# shellcheck disable=SC1091
source /tmp/openhackathon-env.sh

echo "[dev-eval] PORT=$PORT  VITE_APP_URL=$VITE_APP_URL  CORS_ORIGINS=$CORS_ORIGINS"

# Run server + client concurrently
exec npx concurrently -k -n api,web -c blue,green \
  "npx tsx api/index.ts" \
  "npx vite --port 5174 --strictPort --host 127.0.0.1"
