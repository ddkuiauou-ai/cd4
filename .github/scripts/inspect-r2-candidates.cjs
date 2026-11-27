const { createR2Client, r2Config } = require('../../scripts/static-r2-client.cjs');

async function inspect() {
  const config = r2Config();
  const pointerKey = 'cd-release/current.json';
  const client = createR2Client(config);
  const pointer = (await client.getJson(config.stateBucket, pointerKey))?.value;
  const current = pointer?.current;
  const candidates = [];
  for await (const key of client.listPortableKeys()) {
    const id = /^cd-release\/portable\/refs\/([a-f0-9]{64})\.json$/.exec(key)?.[1];
    if (!id || id === current?.candidateId) continue;
    const ref = (await client.getJson(config.stateBucket, key))?.value;
    if (ref?.mode !== 'full' || ref.baseCandidateId !== (current?.candidateId ?? null)) continue;
    const run = /^cd-release\/portable\/source\/(release-[A-Za-z0-9]+)\//.exec(ref.source?.[0] ?? '')?.[1];
    candidates.push({ candidateId: id, run });
  }
  console.log(JSON.stringify({ fullCandidates: candidates }));
}

inspect().catch(error => { console.error(error.message); process.exitCode = 1; });
