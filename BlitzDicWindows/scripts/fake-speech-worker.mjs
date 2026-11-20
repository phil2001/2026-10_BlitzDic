// Stands in for speech/worker.py in Node tests: same argv and stdin/stdout
// protocols, no models and no access to other applications.
const args = process.argv.slice(2);
if (args[0] === '--target-service') {
  // Line protocol of speech/target_service.py.
  process.stdout.write(`${JSON.stringify({ event: 'ready' })}\n`);
  let buffer = '';
  process.stdin.on('data', chunk => {
    buffer += chunk.toString('utf8');
    for (let end; (end = buffer.indexOf('\n')) >= 0;) {
      const { id, request } = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
      if (request.die) process.exit(3);
      const answer = request.fail ? { id, error: request.fail } : { id, result: { action: request.action, text: request.text ?? null, pid: process.pid } };
      setTimeout(() => process.stdout.write(`${JSON.stringify(answer)}\n`), request.delayMs ?? 0);
    }
  });
} else {
  const preloaded = args[0] === '--preload' ? args.slice(1, 3) : null;
  const chunks = [];
  process.stdin.on('data', chunk => chunks.push(chunk));
  process.stdin.on('end', () => {
    const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    setTimeout(() => {
      process.stdout.write(JSON.stringify({ text: 'ok', action: request.action, preloaded, pid: process.pid }));
    }, request.delayMs ?? 0);
  });
}
