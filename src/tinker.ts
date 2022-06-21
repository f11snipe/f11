import { F11Controller } from './core/Controller';

// const std = [4444, 6969, 9999];
const xta = [3333, 4444, 4321, 5555, 6666, 6789, 6969, 7777, 9876, 9999]

const ctl = new F11Controller('0.0.0.0', xta, 1337, 1111, 42069, `[demo] F11>`);

ctl.gen(false, (err) => {
  if (err) {
    ctl.log.error(err);
  } else {
    ctl.startServer();
    ctl.register('F11snipe');
  }
});
