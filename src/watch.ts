import fs from 'fs';
import async from 'async';

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
            console.error(err);
          } else if (stats.isDirectory()) {
            walk(p, (err) => {
              if (err) {
                console.error(err);
              }
            });
          }
        });
      }
    });
  }
}

const walk = (dir: string, cb: (err?: Error | null) => void) => {
  console.log(`Walk dir: ${dir}`);

  if (!walked[dir] && fs.existsSync(dir)) {
    fs.readdir(dir, (err, entries) => {
      if (err) {
        console.error(err);
        cb();
      } else {
        walked[dir] = entries;

        watch(dir);

        async.each(entries, (f, next) => {
          const p = `${dir}/${f}`;

          fs.lstat(p, (err, stats) => {
            if (err) {
              console.error(err);
              next();
            } else if (stats.isDirectory()) {
              walk(p, next);
            } else {
              next();
            }
          });
        }, cb);
      }
    });
  } else {
    cb();
  }
};

async.each(WATCH_DIRS, (dir, next) => {
  walk(dir, next);
}, (err) => {
  if (err) console.error(err);

  console.log(`DONE: Walked ${Object.keys(walked).length} directories`);

  setInterval(() => {
    console.log(`INFO: ${watching.length} watching | ${Object.keys(walked).length} walked`);
  }, 5000);
});

// WATCH_DIRS.forEach(dir => {
//   walk(dir);

//   // console.log(`WATCH: ${dir}`);

//   // walk(dir);

//   // fs.watch(dir, (e, f) => {
//   //   if (e && f) {
//   //     console.log(`[${e}]: ${dir}/${f}`);
//   //   } else {
//   //     console.warn(`WARN: e='${e}' f='${f}' (dir=${dir})`);
//   //   }
//   // });
// });

