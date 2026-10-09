// Loaded into the build and its Node child processes; never logs arguments or environment values.
const fs = require('node:fs');
const { threadId } = require('node:worker_threads');
const filename = process.env.STATIC_BUILD_RESOURCE_LOG;
if (filename) {
  function record(event) {
    try {
      fs.appendFileSync(filename, `${JSON.stringify({ event, at: Date.now(), pid: process.pid, ppid: process.ppid,
        ...(event === 'start' ? { nodeVersion: process.versions.node, execPath: process.execPath } : {}),
        threadId, ...process.memoryUsage(), cpu: process.cpuUsage() })}\n`);
    } catch { /* Monitoring must not turn a successful build into a failed build. */ }
  }
  record('start');
  const timer = setInterval(() => record('sample'), 2000);
  timer.unref();
  process.once('exit', () => { clearInterval(timer); record('exit'); });
}
