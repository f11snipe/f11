import fs from 'fs';
import async from 'async';

const INTERVAL = 100;
const PROC_DIR = '/proc';

const PROC_DATA = [
  'cgroup',
  'cmdline',
  'environ',
];

const PROC_LINKS = [
  // links?
  'cwd',
  'exe',
  'root',
];

const PROC_DIRS = [
  // nested dirs?
  // 'fd',
  // 'fdinfo',
];

interface ProcData {
  proc: number;
  uid: number;
  gid: number;
  cgroup?: string;
  cmdline?: string;
  environ?: string; // array/objects?
  cwd?: string;
  exe?: string;
  root?: string;
  stats?: fs.Stats
}

const track = (proc: number, cb: (err?: Error | null) => void) => {
  fs.lstat(`/proc/${proc}`, (err, stats) => {
    // if (err) console.warn(err);

    const { uid, gid } = stats;
    const procData: ProcData = {
      stats,
      proc,
      uid,
      gid
    };

    async.each(PROC_DATA, (name, next) => {
      const dpath = [PROC_DIR, proc, name].join('/');
      fs.readFile(dpath, (err, data) => {
        // if (err) console.warn(err);
        // console.log(proc, name, dpath, data?.toString());
        procData[name] = data?.toString();
        next();
      });
    }, (err) => {
      // if (err) throw err;
      // if (err) console.warn(err);

      async.each(PROC_LINKS, (link, next) => {
        const dpath = [PROC_DIR, proc, link].join('/');
        fs.readlink(dpath, (err, value) => {
          // if (err) console.warn(err);
          // console.log(proc, link, dpath, value);
          procData[link] = value;
          next();
        });
      }, (err) => {
        // if (err) throw err;
        // if (err) console.warn(err);

        console.log(`DONE: track(${proc})`, procData);

        cb();
      });
    });
  });
};

const scan = async () => {
  const procs = fs.readdirSync(PROC_DIR);

  console.log(procs);

  async.each(procs, (proc, next) => {
    if (/^[0-9]+$/.test(proc)) {
      track(parseInt(proc), next);
    }
  }, (err) => {
    if (err) throw err;

    console.log('DONE: scan()');
  });
};

scan();
