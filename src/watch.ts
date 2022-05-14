import fs from 'fs';

const WATCH_DIRS = [
  '/tmp',
  '/etc',
  '/opt'
];

let walked: { [dir: string]: Error | string[] } = {};
let watching: string[] = [];

const watch = (dir: string) => {
  if (!watching.includes(dir)) {
    watching.push(dir);

    fs.watch(dir, (e, f) => {
      if (e && f) {
        const p = `${dir}/${f}`;
        console.log(`[${e}]: ${p}`);
        fs.lstat(p, (err, stats) => {
          if (err) {
            // console.error(err);
          } else if (stats.isDirectory()) {
            // console.log(`Walk recurse: ${p}`);
            walk(p);
          }
        });
      } else {
        console.warn(`WARN: e='${e}' f='${f}' (dir=${dir})`);
      }
    });
  }
}

const walk = (dir: string) => {
  if (!walked[dir] && fs.existsSync(dir)) {
    fs.readdir(dir, (err, entries) => {
      if (err) {
        // console.error(err);
        walked[dir] = err;
      } else {
        watch(dir);
        walked[dir] = entries;

        entries.forEach(f => {
          const p = `${dir}/${f}`;

          fs.lstat(p, (err, stats) => {
            if (err) {
              // console.error(err);
            } else if (stats.isDirectory()) {
              // console.log(`Walk recurse: ${p}`);
              walk(p);
            }
          });
        });
      }
    });
  }
};

WATCH_DIRS.forEach(dir => {
  walk(dir);

  // console.log(`WATCH: ${dir}`);

  // walk(dir);

  // fs.watch(dir, (e, f) => {
  //   if (e && f) {
  //     console.log(`[${e}]: ${dir}/${f}`);
  //   } else {
  //     console.warn(`WARN: e='${e}' f='${f}' (dir=${dir})`);
  //   }
  // });
});

setInterval(() => {
  console.log(`STATUS: ${watching.length} watching | ${Object.keys(walked).length} walked`);
}, 5000);