// Stream-guard reopen probe (parked #535 follow-up). Serves 200 MB to six
// concurrent loopback clients that read at fixed rates, with no guard, and
// writes one JSON line per stream per second: bytesWritten, bytes whose write
// callback completed, and the socket's tx_queue from /proc/net/tcp.
// Usage: node probe.mjs [seconds=130] > run.jsonl
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';

const SECONDS = Number(process.argv[2] || 130);
const RATES = [10_240, 10_240, 10_240, 4096, 4096, 4096];
const PAYLOAD = 200_000_000;
const WRITE = 1 << 16;
const hex = (port) => port.toString(16).toUpperCase().padStart(4, '0');
const txQueue = (socket) => {
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n').slice(1)) {
      const cols = line.trim().split(/\s+/);
      if (
        cols.length > 4 &&
        cols[1].endsWith(`:${hex(socket.localPort)}`) &&
        cols[2].endsWith(`:${hex(socket.remotePort)}`)
      )
        return parseInt(cols[4].split(':')[0], 16);
    }
  }
  return null;
};
const sysctl = (name) => {
  try {
    return fs.readFileSync(`/proc/sys/${name.replaceAll('.', '/')}`, 'utf8').trim();
  } catch {
    return null;
  }
};
const start = Date.now();
console.log(
  JSON.stringify({
    kind: 'setup',
    at: new Date(start).toISOString(),
    node: process.version,
    kernel: `${os.type()} ${os.release()}`,
    transport: 'TCP over loopback 127.0.0.1, plain HTTP (node:http server and client)',
    client: 'node:http get; on each data chunk pause, resume after chunk.length / rate seconds',
    payload_bytes: PAYLOAD,
    write_bytes: WRITE,
    writes: 'drain-paced res.write of write_bytes each, callback counted',
    rates_bytes_per_second: RATES,
    sysctl: Object.fromEntries(
      [
        'net.ipv4.tcp_wmem',
        'net.ipv4.tcp_rmem',
        'net.core.wmem_max',
        'net.core.rmem_max',
        'net.ipv4.tcp_moderate_rcvbuf',
      ].map((n) => [n, sysctl(n)])
    ),
    seconds: SECONDS,
  })
);
const server = http.createServer((req, res) => {
  const socket = res.socket;
  const stream = req.url.slice(1);
  let completed = 0;
  const sample = setInterval(
    () =>
      console.log(
        JSON.stringify({
          kind: 'sample',
          stream,
          t: Math.round((Date.now() - start) / 1000),
          bytes_written: socket.bytesWritten,
          write_callbacks_bytes: completed,
          tx_queue: txQueue(socket),
        })
      ),
    1000
  );
  res.on('close', () => clearInterval(sample));
  let left = PAYLOAD;
  const pump = () => {
    while (left > 0) {
      const n = Math.min(left, WRITE);
      left -= n;
      if (!res.write(Buffer.alloc(n, 7), () => (completed += n))) return res.once('drain', pump);
    }
    res.end();
  };
  pump();
});
server.listen(0, '127.0.0.1', () => {
  RATES.forEach((rate, i) =>
    http.get({ host: '127.0.0.1', port: server.address().port, path: `/${i}-${rate}` }, (res) =>
      res.on('data', (chunk) => {
        res.pause();
        setTimeout(() => res.resume(), (chunk.length / rate) * 1000);
      })
    )
  );
  setTimeout(() => process.exit(0), SECONDS * 1000 + 500);
});
