import { F11Controller } from './core/Controller';

const user = process.argv.length > 2 ? process.argv[2] : 'F11snipe';

// const std = [4444, 6969, 9999];
//const xta = [4444, 4321, 5555, 6666, 6789, 6969, 7777, 9876, 9999]
const xta = [];
const ctl = new F11Controller('0.0.0.0', xta, 4766, 1221, 420691, `[koth] F11> `);

ctl.gen(false, (err) => {
  if (err) {
    ctl.log.error(err);
  } else {
    ctl.register(user);
  }
});
