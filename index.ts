// Imports
import { spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
// Env vars
const {
  TYPE = 'echo',
  PROMPT = 'snipe> ',
} = process.env;
// Constants
const PORT = TYPE === 'echo' ? 7070 : 7777;
const HOST = '0.0.0.0';
// Create net tcp server
const server = net.createServer();
// Define empty array of net.Socket[] to track open connections
const sockets: net.Socket[] = [];
// Intialize and listen for connections
server.listen(PORT, HOST, () => {
  console.log(`F11snipe Server - ${HOST}:${PORT}`);
});

// Main handler for new connections
server.on('connection', (socket: net.Socket) => {
  try {
    const id = `${socket.remoteAddress}:${socket.remotePort}`;
    const shell = spawn(`/bin/bash`);
    const prompt = (_d) => socket.write(`\n${PROMPT}`);
    console.log(`[${id}] New Connection`);
    if (fs.existsSync('msgs/welcome.txt')) socket.write(fs.readFileSync('msgs/welcome.txt'));
    socket.write(`\n${PROMPT}`);
    socket.pipe(shell.stdin);
    shell.stdout.pipe(socket);
    shell.stderr.pipe(socket);
    shell.stdout.on('data', prompt);
    shell.stderr.on('data', prompt);
    shell.on('close', (code) => {
      console.log(`[${id}] Child process exited with code ${code}`);
    });

    sockets.push(socket);

    socket.on('close', (hadError: boolean) => {
      if (hadError) console.log(`Socket.on(close) with error!`);
      let idx = sockets.findIndex((sock) => sock.remoteAddress === socket.remoteAddress && sock.remotePort === socket.remotePort);
      if (idx >= 0) {
        sockets.splice(idx, 1);
      }

      console.log(`[${id}] Closed`);
    });
  } catch (err) {
    console.log('Caught connection error', err);
  }
});
