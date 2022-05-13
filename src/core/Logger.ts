import colors from 'colors/safe';
import {
  IF11Logger,
  IF11LogOptionsMap,
  IF11LogTextTheme,
  IF11LogOptions,
  F11LogTextThemeValue
} from './types';

export class F11Logger implements IF11Logger {
  public verbose = false;
  public options: IF11LogOptionsMap = {
    info: {
      timestamp: true
    },
    warn: {
      prefix: 'WARNING:',
      timestamp: true,
      color: 'yellow'
    },
    error: {
      prefix: 'ERROR:',
      timestamp: true,
      color: 'red'
    },
    success: {
      prefix: 'SUCCESS:',
      timestamp: true,
      color: 'green'
    },
    debug: {
      prefix: 'DEBUG:',
      timestamp: true,
      color: 'cyan'
    }
  };

  constructor(public prefix?: string, public theme?: IF11LogTextTheme) {
    this.verbose = this.verbose || !!process.env.VERBOSE;

    if (theme) {
      colors.setTheme(theme);
    }
  }

  timestamp(): string {
    // Create new Date object
    const d = new Date();

    // Return date in the format "M/D/YYYY h:i:s AM/PM"
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  colorize(args: any, color: F11LogTextThemeValue | string): any {
    if (typeof args === 'string') {
      return colors[color](args);
    } else if (typeof args === 'object') {
      if (Array.isArray(args)) {
        return args.map((arg) => (typeof arg === 'string' ? colors[color](arg) : arg));
      } else {
        const argsCopy = { ...args };

        Object.keys(argsCopy).forEach((key) => {
          if (typeof argsCopy[key] === 'string') {
            argsCopy[key] = colors[color](argsCopy[key]);
          }
        });

        return argsCopy;
      }
    }

    return args;
  }

  log(args: any, options?: IF11LogOptions) {
    let output = Array.isArray(args) ? [...args] : [args];

    if (options?.prefix) {
      output = [options.prefix].concat(output);
    }

    if (this.prefix) {
      output = [this.prefix].concat(output);
    }

    if (options?.timestamp) {
      output = [`[${this.timestamp()}]`].concat(output);
    }

    if (options?.color) {
      output = this.colorize(output, options.color);
    }

    if (options?.theme) {
      output = this.colorize(output, options.theme);
    }

    console.log(...output);
  }

  out =
    (options?: IF11LogOptions) =>
    (...args: any[]) =>
      this.log(args, options);

  info = this.out(this.options.info);
  warn = this.out(this.options.warn);
  error = this.out(this.options.error);
  success = this.out(this.options.success);
  debug = (...args: any[]) => {
    if (this.verbose) {
      this.out(this.options.debug)(...args);
    }
  };
}
