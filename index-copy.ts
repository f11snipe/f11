// Imports
import colors from 'colors/safe';
import { spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import tty from 'tty';
import {} from 'stream';

    //   Type 'PtySocket' is missing the following properties from type 'WriteStream': clearScreenDown, getColorDepth, hasColors, columns, rowsts(2322)
class PtySocket extends tty.WriteStream {
  // public isTTY = false;
  // public getWindowSize: () => [number, number];
  // public cursorTo: Function;
  // public clearLine: Function;
  // public moveCursor: Function;

  // constructor(options?: net.SocketConstructorOpts | undefined) {
  //   super(options);
  // }
}


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
// Define empty array of PtySocket[] to track open connections
const sockets:( PtySocket& { fd: 1; })[] = [];
const timestamp = (): string => new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

// Intialize and listen for connections
server.listen(PORT, HOST, () => {
  console.log(`${timestamp()} | F11snipe Server - ${HOST}:${PORT}`);
});

// Main handler for new connections
server.on('connection', (socket: (PtySocket & { fd: 1; })) => {
  const id = `${socket.remoteAddress}:${socket.remotePort}`;
  const log = (...args) => console.log(`${timestamp()} | [${id}]`, ...args);

  try {
    // socket.pipe(process.stdin);
    // process.stdout.pipe(socket);
    // process.stderr.pipe(socket);

    // const shell = spawn(`/bin/bash`, [], { stdio: 'inherit' });
    const shell = spawn(`/bin/bash`);
    if (!shell.stdin || !shell.stdout || !shell.stderr) {
      let missing: string[] = [];

      if (!shell.stdin) missing.push('stdin');
      if (!shell.stdout) missing.push('stdout');
      if (!shell.stderr) missing.push('stderr');

      throw new Error(`Failed to spawn shell. Missing from shell: ${missing.join(',')}`);
    }

    // const shell = spawn(`/bin/bash`);
    // process.stdout = socket;

    // socket.on('data', (d) => log('socket data', d.toString()));

    // socket.pipe(process.stdin);

    // const shell = spawn(`/bin/bash`, [], { stdio: [0,1,2]});
    const ins = ['close', 'drain', 'error', 'finish', 'pipe', 'unpipe'];
    const outs = ['close', 'data', 'end', 'error', 'pause', 'readable', 'resume'];

    // ins.forEach((e, i) => {
    //   shell.stdin?.on(e, (d) => log(`[${i}] shell.stdin.on('${e}') =>`, d));
    // });

    // outs.forEach((e, i) => {
    //   shell.stdout?.on(e, (d) => log(`[${i}] shell.stdout.on('${e}') =>`, d));
    //   shell.stderr?.on(e, (d) => log(`[${i}] shell.stderr.on('${e}') =>`, d));
    // });

    // log(`New Connection`, shell.stdin, shell.stdout, shell.stderr);
    log(`New Connection`);

    if (fs.existsSync('msgs/welcome.txt')) socket.write(fs.readFileSync('msgs/welcome.txt'));

    shell.stdin.write(`${STABALIZE}\r\n`);

    socket.pipe(shell.stdin);
    shell.stdout.pipe(socket);
    shell.stderr.pipe(socket);

    // socket.pipe(process.stdin);
    // process.stdout.pipe(socket);
    // process.stderr.pipe(socket);

    // process.stdout.on('resize', () => {});
    // process.stderr.on('resize', () => {});

    shell.stdout.on('data', (data) => {
      log('shell.stdout', data.toString());
      // socket.write(data);
    });

    shell.stderr.on('data', (data) => {
      log('shell.stderr', data.toString());
      // socket.write(data);
      });

    // What about no out?? on enter?
    shell.on('close', (code) => {
      log(`Child process exited with code ${code}`);
    });

    sockets.push(socket);

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
