import * as net from 'net';

const { RHOST = '127.0.0.1', RPORT = '80' } = process.env;
const MAX_WAIT = 600000; // 10 minutes
const INTERVAL = 100; // 100ms
const TIMEOUT = 2000;
const report: { [port: number]: string } = {};

const categorize = (data: string): string[] => {
  const cats: string[] = [ 'FTP', 'SSH', 'TELNET', 'MYSQL', 'SMB', 'SAMBA', 'RPC', 'BIND' ];
  return cats.filter(cat => (new RegExp(cat, 'im')).test(data));
};

const testPort = (port: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();

    const onError = (...args) => {
      sock.destroy();
      reject(new Error(`Socket error: ${port}`));
    };

    sock.setTimeout(TIMEOUT);
    sock.once('error', onError);
    sock.once('timeout', onError);

    sock.connect(port, RHOST, () => {
      report[port] = `[open] ${port}/tcp `.padEnd(18);

      sock.on('data', (data) => {
        report[port] += ` :: [${categorize(data.toString()).join(', ')}]`.padEnd(16);
        report[port] += ` :: ${data.toString().split(`\n`)[0]}`
      });

      sock.end();
      resolve();
    });
  });
}

const waitForPort = (port: number, cb: () => void): void => {
  testPort(port).then(res => {
    console.log(`OPEN ${port}`);
    cb();
  }).catch(err => {
    setTimeout(() => {
      waitForPort(port, cb);
    }, INTERVAL);
  });
}

const runScan = () => {
  const started = Date.now();
  const port = parseInt(RPORT, 10);

  console.log(`Waiting for ${RHOST} port ${port} to open...`);

  waitForPort(port, () => {
    const finished = Date.now();
    const duration = finished - started;
    const seconds  = (duration / 1000).toFixed(2);

    console.log(Object.values(report).join(`\n`));
    console.log(`Finished (${port} open in ${seconds}s)`);
  });
};

runScan();
