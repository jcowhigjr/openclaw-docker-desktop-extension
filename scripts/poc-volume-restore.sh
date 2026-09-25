#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# Synthetic rehearsal only: never mount an existing application volume.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <existing-local-image-with-node-and-GNU-tar>" >&2
  exit 2
fi
docker_bin="${DOCKER:-docker}"
image_id="$("$docker_bin" image inspect "$1" --format '{{.Id}}')"
[[ "$image_id" == sha256:* ]] || exit 1
scratch="$(mktemp -d)"
run_id="openclaw-restore-poc-$(date -u +%Y%m%d%H%M%S)-$$"
owner_label="io.openclaw.restore-poc"
volumes=()
cleanup() {
  result=$?
  trap - EXIT
  # A failed/interrupted docker run can leave its helper behind.
  if "$docker_bin" container inspect "$run_id" >/dev/null 2>&1; then
    owner="$("$docker_bin" inspect "$run_id" --format '{{index .Config.Labels "io.openclaw.restore-poc"}}')"
    if [ "$owner" = "$run_id" ]; then
      "$docker_bin" rm -f "$run_id" >/dev/null || result=1
    else
      echo 'FAIL: cleanup refused a helper with mismatched ownership' >&2
      result=1
    fi
  fi
  for volume in "${volumes[@]}"; do
    owner="$("$docker_bin" volume inspect "$volume" --format '{{index .Labels "io.openclaw.restore-poc"}}')"
    if [ "$owner" = "$run_id" ]; then
      "$docker_bin" volume rm "$volume" >/dev/null || result=1
    else
      echo 'FAIL: cleanup refused a volume with mismatched ownership' >&2
      result=1
    fi
  done
  rm -rf -- "$scratch"
  if [ "$result" -eq 0 ]; then echo 'PASS: owned helper and three disposable volumes removed'; fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Deliberately no application discovery labels, host mounts, sockets or ports.
helper() {
  "$docker_bin" run --rm -i --pull=never --name "$run_id" \
    --label "$owner_label=$run_id" --network none --read-only \
    --user 0:0 --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE \
    --cap-add FOWNER --security-opt no-new-privileges \
    --pids-limit 64 --memory 256m --tmpfs /tmp:rw,noexec,nosuid,size=16m \
    --entrypoint /bin/sh "$@"
}
for role in source archive restored; do
  volume="$run_id-$role"
  if "$docker_bin" volume inspect "$volume" >/dev/null 2>&1; then
    echo 'FAIL: disposable volume name already exists' >&2
    exit 1
  fi
  "$docker_bin" volume create --label "$owner_label=$run_id" "$volume" >/dev/null
  volumes+=("$volume")
done
source_volume="${volumes[0]}"
archive_volume="${volumes[1]}"
restored_volume="${volumes[2]}"
printf 'Helper image ID: %s\n' "$image_id"
helper --mount "type=volume,src=$source_volume,dst=/data" "$image_id" -c 'node' <<'JS'
const fs = require('fs');
fs.mkdirSync('/data/workspace/empty', {recursive:true});
fs.writeFileSync('/data/.fixture-config', '{"schema":1,"synthetic":true}\n', {mode:0o600});
fs.writeFileSync('/data/workspace/notes with spaces.txt', 'pre-upgrade marker\n', {mode:0o640});
fs.symlinkSync('notes with spaces.txt', '/data/workspace/notes-link');
for (const p of ['/data/.fixture-config', '/data/workspace', '/data/workspace/empty', '/data/workspace/notes with spaces.txt']) fs.chownSync(p,1000,1000);
fs.lchownSync('/data/workspace/notes-link',1000,1000);
fs.chmodSync('/data/workspace',0o750);
JS

manifest() {
  helper --mount "type=volume,src=$1,dst=/data,readonly" "$image_id" -c 'node' <<'JS'
const fs=require('fs'), crypto=require('crypto'), rows=[];
function walk(rel) {
  const path='/data/'+rel, s=fs.lstatSync(path);
  const row={path:rel,mode:s.mode & 0o7777,uid:s.uid,gid:s.gid};
  if(s.isSymbolicLink()) {row.type='link';row.target=fs.readlinkSync(path);}
  else if(s.isDirectory()) {row.type='directory';}
  else if(s.isFile()) {row.type='file';row.sha256=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');}
  else throw Error('unexpected fixture type');
  rows.push(row);
  if(s.isDirectory()) for(const child of fs.readdirSync(path).sort()) walk(rel ? rel+'/'+child : child);
}
walk(''); console.log(JSON.stringify(rows));
JS
}
manifest "$source_volume" >"$scratch/before.json"
helper --mount "type=volume,src=$source_volume,dst=/source,readonly" \
  --mount "type=volume,src=$archive_volume,dst=/archive" "$image_id" \
  -ec 'tar --numeric-owner -czpf /archive/snapshot.tar.gz -C /source .; cd /archive; sha256sum snapshot.tar.gz > snapshot.sha256'

# Model a destructive migration in synthetic data after the backup.
helper --mount "type=volume,src=$source_volume,dst=/data" "$image_id" \
  -ec 'printf "schema-v2\n" > /data/.fixture-config; rm "/data/workspace/notes with spaces.txt"; printf "new state\n" > /data/migration-only'
manifest "$source_volume" >"$scratch/changed.json"
if cmp -s "$scratch/before.json" "$scratch/changed.json"; then
  echo 'FAIL: synthetic migration did not change the fixture' >&2
  exit 1
fi
echo 'PASS: post-snapshot synthetic migration changed the source'

helper --mount "type=volume,src=$archive_volume,dst=/archive,readonly" \
  --mount "type=volume,src=$restored_volume,dst=/restored" "$image_id" \
  -ec 'cd /archive; sha256sum -c snapshot.sha256; tar --numeric-owner --same-owner -xzpf snapshot.tar.gz -C /restored'
manifest "$restored_volume" >"$scratch/restored.json"
cmp "$scratch/before.json" "$scratch/restored.json"
echo 'PASS: restored file hashes, numeric ownership, modes, symlink and empty directory match'
manifest "$source_volume" >"$scratch/after.json"
cmp "$scratch/changed.json" "$scratch/after.json"
echo 'PASS: restoring into a separate volume left the changed source intact'
helper --mount "type=volume,src=$archive_volume,dst=/archive" "$image_id" \
  -ec 'printf corrupt >> /archive/snapshot.tar.gz'
if helper --mount "type=volume,src=$archive_volume,dst=/archive,readonly" \
  --mount "type=volume,src=$restored_volume,dst=/restored" "$image_id" \
  -ec 'cd /archive; sha256sum -c snapshot.sha256; tar --numeric-owner --same-owner -xzpf snapshot.tar.gz -C /restored' \
  >"$scratch/corrupt-check.txt" 2>&1; then
  echo 'FAIL: a corrupt snapshot was accepted' >&2
  exit 1
fi
grep -F 'snapshot.tar.gz: FAILED' "$scratch/corrupt-check.txt" >/dev/null
manifest "$restored_volume" >"$scratch/after-rejection.json"
cmp "$scratch/restored.json" "$scratch/after-rejection.json"
echo 'PASS: corrupt snapshot rejected before extraction; restored data unchanged'
echo 'LIMIT: synthetic offline data only; no OpenClaw migration, database consistency or UI acceptance tested'
