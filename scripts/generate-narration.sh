#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUT="$ROOT/public/video/audio"
TMP="$ROOT/.narration-tmp"
mkdir -p "$OUT" "$TMP"

if command -v espeak-ng >/dev/null 2>&1; then
  SPEAK=espeak-ng
elif command -v espeak >/dev/null 2>&1; then
  SPEAK=espeak
else
  echo "Install eSpeak NG (or eSpeak) to generate the demo narration." >&2
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Install ffmpeg to encode the demo narration." >&2
  exit 1
fi

cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

render_scene() {
  number=$1
  text=$2
  wav="$TMP/scene-$number.wav"
  mp3="$OUT/scene-$number.mp3"
  "$SPEAK" -v en-us+f3 -s 155 -p 48 -a 175 -w "$wav" "$text"
  ffmpeg -loglevel error -y -i "$wav" -codec:a libmp3lame -q:a 3 "$mp3"
}

render_scene 1 "Generated code looks editable, but the edit is temporary. Change an API client or type file directly, and the next generator run can erase the patch. GenTether asks the repository one question before an agent writes: where does this change actually belong?"
render_scene 2 "The answer is a provenance graph in HydraDB. The OpenAPI source feeds a generator command. That command produces the client. Services and routes import the client, and the checkout test sits downstream. These are typed, directed relationships, not nearby text snippets."
render_scene 3 "First, the agent proposes changing only the generated client. GenTether blocks the patch. HydraDB returns the authoritative OpenAPI source, the exact generation command, both downstream consumers, and the test reached through the import path. The agent now knows what to edit instead."
render_scene 4 "Next, the agent changes the OpenAPI source but forgets the generated output. GenTether returns review. The source is correct, but the connected client is stale. The patch is not ready until regeneration produces and includes that artifact."
render_scene 5 "Finally, the source and generated client change together. GenTether allows the coordinated patch and returns the commands that should run before merge. The result is explainable because every decision is tied to a concrete graph path."
render_scene 6 "HydraDB is load-bearing here. It stores the source, command, artifact, consumers, and tests as stable vertices. GenTether queries the source-command-output chain and performs a bounded reverse import traversal. If the live graph cannot prove complete provenance, the gate fails closed to review instead of inventing certainty."
render_scene 7 "The same gate is available through the web interface, HTTP API, and MCP tools. A coding agent can resolve the true edit target, check a proposed patch, and plan regeneration before touching a file. GenTether: edit the source, never the artifact."

printf 'Generated narration in %s\n' "$OUT"
