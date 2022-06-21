import { F11Controller } from './core/Controller';

const ctl = new F11Controller('0.0.0.0', [4444, 6969, 9999]);

ctl.gen(false, (err) => {
  if (err) {
    ctl.log.error(err);
  } else {
    ctl.startServer();
    ctl.register('Example');
  }
});
