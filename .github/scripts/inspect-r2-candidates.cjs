const { createR2Client, r2Config } = require('../../scripts/static-r2-client.cjs');

async function inspect() {
  const config = r2Config();
  const pointerKey = 'cd-release/current.json';
  const representations = [];
  function reader(identity) {
    return createR2Client(config, {
      async request(url, options) {
        const headers = new Headers(options.headers);
        if (identity) headers.set('accept-encoding', 'identity');
        const response = await fetch(url, { ...options, headers });
        if (url.pathname.endsWith('/' + pointerKey) && response.ok) {
          const etag = response.headers.get('etag') ?? '';
          representations.push({ requested: headers.get('accept-encoding') ?? 'default',
            encoding: response.headers.get('content-encoding') ?? 'identity',
            etag: etag.startsWith('W/') ? 'weak' : /^"[^"]+"$/.test(etag) ? 'strong' : 'other' });
        }
        return response;
      },
    });
  }
  await reader(false).getJson(config.stateBucket, pointerKey);
  const client = reader(true);
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
  console.log(JSON.stringify({ day: current?.day, releaseId: current?.releaseId, commit: current?.commit,
    portable: Boolean(current?.portable), pending: pointer?.pending?.id ?? null, representations, fullCandidates: candidates }));
}

inspect().catch(error => { console.error(error.message); process.exitCode = 1; });
