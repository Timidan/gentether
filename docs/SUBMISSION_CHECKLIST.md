# Hack Hydra Submission Checklist

## Repository

- [ ] Create a fresh repository during the Hack Hydra event window.
- [ ] Keep it private while preparing if needed.
- [ ] Make the repository public before submitting.
- [ ] Confirm no participant-written commit predates the event start.
- [x] Include an open-source licence.
- [x] Include clear setup and test instructions.
- [x] Explain exactly how HydraDB is used.
- [x] Document environment variables.
- [x] Include a deterministic fallback without mislabelling it HydraDB.
- [x] Include automated tests.

## Live demo

- [ ] Run HydraDB and confirm the status pill reads `HydraDB · live`.
- [ ] Re-index after HydraDB starts.
- [ ] Run all three gate scenarios.
- [ ] Trace the generated client graph.
- [ ] Show the MCP tool names.
- [ ] Keep the recording below three minutes.
- [ ] Avoid showing secrets or local personal paths.

## Final verification

```bash
npm install
npm test
npm run demo
npm run build
npm start
```

HydraDB:

```bash
bash scripts/init-hydra-data.sh
docker compose up --build
curl -X POST http://127.0.0.1:8787/api/reindex
curl http://127.0.0.1:8787/api/status
```

Expected status:

```json
{
  "engine": "hydradb",
  "hydraConnected": true
}
```

## Submission form

- [ ] Public GitHub URL
- [ ] Demo video URL
- [ ] Track 02B selected
- [ ] One-sentence pitch
- [ ] HydraDB explanation
- [ ] Team member details
- [ ] Final form submitted before the official deadline
