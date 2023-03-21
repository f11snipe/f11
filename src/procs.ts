import fs from 'fs';
import async from 'async';

const INTERVAL = 50;
const PROC_DIR = '/proc';

const PROC_DATA = [
  'cmdline',
  'cgroup',
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
  pid: number;
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

const history: ProcData[] = [];
const current: { [key: string]: ProcData } = {};

const str = (data: ProcData): string => {
  const { pid, uid, gid, cmdline } = data;
  return `[${pid}] USER=${uid} GROUP=${gid} | ${cmdline}`;
};

const track = (pid: number, cb: (err?: Error | null) => void) => {
  fs.lstat(`${PROC_DIR}/${pid}`, (err, stats) => {
    if (err) {
      console.warn(err);
      return;
    }

    const { uid, gid } = stats;
    const procData: ProcData = {
      stats,
      pid,
      uid,
      gid
    };

    async.each(PROC_DATA, (name, next) => {
      const dpath = [PROC_DIR, pid, name].join('/');
      fs.readFile(dpath, (err, data) => {
        // if (err) console.warn(err);
        // console.log(pid, name, dpath, data?.toString());
        procData[name] = data?.toString();
        next();
      });
    }, (err) => {
      // if (err) throw err;
      // if (err) console.warn(err);

      async.each(PROC_LINKS, (link, next) => {
        const dpath = [PROC_DIR, pid, link].join('/');
        fs.readlink(dpath, (err, value) => {
          // if (err) console.warn(err);
          // console.log(pid, link, dpath, value);
          procData[link] = value;
          next();
        });
      }, (err) => {
        // if (err) throw err;
        // if (err) console.warn(err);

        if (!current[pid]) {
          current[pid] = procData;
          console.log('START:', str(procData));
        }

        cb();
      });
    });
  });
};

const scan = (): void => {
    const procs = fs.readdirSync(PROC_DIR);

    // console.log(procs);

    async.each(procs, (pid, next) => {
      if (/^[0-9]+$/.test(pid)) {
        track(parseInt(pid), next);
      }
    }, (err) => {
      if (err) throw err;

      async.each(Object.keys(current), (pid, next) => {
        if (!procs.includes(pid)) {
          console.log('DONE:', str(current[pid]));
          delete current[pid];
        }
      }, (err) => {
        if (err) {
          console.warn(err);
        }

        // console.log('SCAN FINISHED');
        // cb();
      });
    });
};

// const poll = () => {
//   scan((err) => {
//     if (err) {
//       console.warn(err);
//     }

//     setTimeout(() => poll(), INTERVAL);
//   });
// }

// poll();
// scan();

setInterval(() => {
  scan();
}, INTERVAL);
