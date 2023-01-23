import net from 'net';
import async from 'async';

const { VMIP = '127.0.0.1', PORTS = '1-65535' } = process.env;
const MAX_SCANS = 1024;
const SCAN_HOST = VMIP;
const TIMEOUT = 2000;
const report: { [port: number]: string } = {};
const ports: number[] = [];
const groups: string[] = PORTS.split(',');

const addPort = (port: number) => ports.includes(port) || ports.push(port);
const mapPorts = () => {
  groups.map(grp => grp.trim()).forEach(grp => {
    if (/^[0-9]+$/.test(grp)) {
      const num = parseInt(grp, 10);

      addPort(num);
    } else if (/^[0-9]+\-[0-9]+$/.test(grp)) {
      const [min, max] = grp.split('-').map(prt => parseInt(prt, 10));

      for (let i = min; i <= max; i++) {
        addPort(i);
      }
    } else {
      console.warn(`ERROR: Invalid port/range given - '${grp}'`);
    }
  });
};

const categorize = (data: string): string[] => {
  const cats: string[] = [ 'FTP', 'SSH', 'TELNET', 'MYSQL', 'SMB', 'SAMBA', 'RPC', 'BIND' ];
  return cats.filter(cat => (new RegExp(cat, 'im')).test(data));
};

const testPort = (host: string, port: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();

    const onError = (...args) => {
      sock.destroy();
      reject(new Error(`Socket error: ${port}`));
    };

    sock.setTimeout(TIMEOUT);
    sock.once('error', onError);
    sock.once('timeout', onError);

    sock.connect(port, host, () => {
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

const runScan = () => {
  const started = Date.now();
  const ips: string[] = [];

  for (let x = 0; x <= 255; x++) {
    for (let y = 0; y <= 255; y++) {
      const ip = `10.10.${x}.${y}`;
      ips.push(ip);
    }
  }
  console.log(`Scanning ${ips.length} ip(s):`);

  async.eachLimit(ips, MAX_SCANS, (ip, next) => {
    testPort(ip, 9999).then(res => {
      console.log(`OPEN ${ip}:9999`);
      next();
    }).catch(err => {
      next();
    });
  }, (err) => {
    if (err) throw err;

    const finished = Date.now();
    const duration = finished - started;
    const seconds  = (duration / 1000).toFixed(2);

    console.log(Object.values(report).join(`\n`));
    console.log(`Finished (${ips.length} ip(s) scanned in ${seconds}s)`);
  });
};

runScan();
