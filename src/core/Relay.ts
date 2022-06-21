import colors from 'colors/safe';
import fs from 'fs';
import os, { UserInfo } from 'os';
import { Socket } from 'net';
import { spawn, spawnSync, SpawnOptionsWithoutStdio, ChildProcessWithoutNullStreams } from 'child_process';
import { TLSSocket, PeerCertificate } from 'tls';
import { WebSocket } from 'ws';
import { IF11Connectable } from './types';
import { F11Base } from './Base';
import { F11Controller } from './Controller';

const SAVE_HINTS = {};
const WEB_HOST = 'https://f11snipe.sh/sh';
const UNIX_SHELLS = ['bash', 'sh'];
const UNIX_DEFAULT = 'bin/sh';
const TMP_DIR = `/tmp/.f11`;
const CMD_PASS = ['ls', 'cat', 'pwd', 'whoami', 'cd', 'curl', 'wget'];


export class F11Relay extends F11Base implements IF11Connectable {
  public cp: ChildProcessWithoutNullStreams;
  public inShell = false;
  public inSpawn = false;
  public address: string;
  public addrLocal: string;
  public addrRemote: string;
  public signature: string;
  public commands: string[] = ['reg', 'whoami', 'exit', 'ping', 'help'];
  public forwards: string[] = ['data', 'close', 'error'];
  public methods: string[] = ['data', 'close', 'error', 'authorized', 'unauthorized'];
  public events: string[] = ['close', 'connect', 'data', 'drain', 'end', 'error', 'lookup', 'ready', 'timeout'];
  public client?: IF11Connectable;
  public relay?: IF11Connectable;
  public disconnecting = false;
  public requireAuthorized = false;
  public clientAuthorized = false;

  constructor(public ctl: F11Controller, public socket: TLSSocket | Socket, public prompt?: string) {
    super();

    this.signature = this.id;
    this.addrLocal = `${socket.localAddress}:${socket.localPort}`;
    this.addrRemote = `${socket.remoteAddress}:${socket.remotePort}`;
    this.address = `L:${this.addrLocal} <> R:${this.addrRemote}`;

    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    const events = ['close', 'connect', 'data', 'drain', 'end', 'error', 'lookup', 'ready', 'timeout'];

    events.forEach((e, i) => {
      this.socket.on(e, (...args) => {
        this.log.debug(`[${i}] socket.on(${e}): ${JSON.stringify(args)}`);
      });
    })

    // this.socket.on('data', this.onData.bind(this));

    // this.client = this;
    // this.convert = new Convert();
  }

  public onData (data) {
    // msg('debug', `SnipeSocket.onData: ${data}`);

    // if (this.cp && this.inShell) {
    //   this.command(data);
    // } else {
    //   this.handle(data);
    // }
  };

  public get peer(): string {
    return `${this.socket.remoteAddress}:${this.socket.remotePort}`;
  }

  public get cert(): PeerCertificate | undefined {
    return this.socket instanceof TLSSocket ? this.socket.getPeerCertificate() : undefined;
  }

  public get isAuthorized(): boolean {
    return !this.requireAuthorized || (this.socket instanceof TLSSocket && this.socket.authorized);
  }

  public authorized(): void {
    const msg = `Authorized: ${this.cert?.subject?.CN}`;

    this.log.success(msg);

    if (this.prompt) {
      this.write(`${msg}\n`.green);
    }

    this.ready();
  }

  public unauthorized(): void {
    const authError = (this.socket as TLSSocket).authorizationError;

    if (this.cert?.subject?.CN && authError) {
      const errMsg = `Unauthorized: ${this.cert?.subject?.CN} (${authError})`;

      this.log.error(errMsg);
      this.debug();

      if (this.prompt) {
        this.write(`${errMsg}\n`.red);
      }
    }

    // setTimeout(() => {
    //   this.exit();
    // }, 1000);
  }

  public write(msg: string, cb?: (err?: Error) => void): void {
    this.socket.write(msg, cb);
  }

  public send(msg: string, keep = true): void {
    this.log.debug(`Sending: ${msg}`, { keep });

    if (this.prompt) {
      this.write(msg);

      if (keep) {
        this.write(`\n${this.prompt}`);
      }
    } else {
      this.log.debug(`NO PROMPT - Skipping full "send" output`);
    }
  }

  public init(commands: string[] = [], forwards: string[] = []): void {
    this.commands = this.commands.concat(commands);
    this.forwards = this.forwards.concat(forwards);

    [...this.commands].concat(this.methods).forEach((cmd) => {
      if (typeof this[cmd] === 'function') {
        this.on(cmd, this[cmd].bind(this));
      } else {
        this.log.warn(`Cannot autoload method: ${cmd}`);
      }
    });

    if (this.isAuthorized) {
      this.forwards.forEach((e) => {
        this.socket.on(e, (...args) => {
          this.log.debug(`Socket.on(${e}) ${args[0]}`, args);
          this.emit(e, ...args);
        });
      });

      this.emit('authorized');
    } else {
      this.emit('unauthorized');
    }
  }

  public debug(): void {
    if (this.socket instanceof TLSSocket) {
      const cert = this.socket.getPeerCertificate();

      this.log.debug(`Cert info`, cert);
    }
  }

  public ready(): void {
    this.send(`[${this.id}] ${this.constructor.name} is ready`);
    this.debug();
  }

  public showPrompt(): void {
    if (this.prompt) {
      this.write(`\n${this.prompt}`);
    }
  }

  public reset(): void {
    this.prompt = this.ctl.prompt;

    if (this.relay) {
      this.log.debug(`Reset relay:`, this.relay.signature, this.relay.id);
      // this.relay.write('exit');
      delete this.relay;
    }

    this.emit('reset');
  }

  public data(data): void {
    const [cmd, ...args] = data
      .toString()
      .split(' ')
      .map((str) => str.trim());

    if (this.relay) {
      if (cmd === 'exit') {
        this.reset();
      } else {
        this.log.debug(`Relay data: ${data}`, this.relay.signature, this.relay.id);
        this.relay.write(data);
      }
    } else {
      if (this.commands.includes(cmd)) {
        this.log.debug(`Running cmd: ${data}`);
        this.emit(cmd, ...args);
      } else if (cmd.trim() !== '') {
        this.log.warn(`Unknown cmd: ${cmd}`);
        this.send(`Unknown cmd: ${cmd} (available: ${this.commands.join(', ')})`);
      }
    }
  }

  public reg(sig: string): void {
    if (sig) {
      this.signature = sig;
      this.log.info(`Registered as: ${sig}`);
      this.send(`Registered as: ${sig}`);
      this.emit('registered');
    } else {
      this.log.warn(`Cannot register without signature!`, sig);
      this.send(`Cannot register without signature!`);
    }
  }

  public whoami(): void {
    this.send(this.client?.signature || this.signature || 'Unknown');
  }

  public ping(): void {
    this.send('pong');
  }

  // public info(prop: string): void {
  //   if (prop && this[prop]) {
  //     this.log.info(`Show prop info: ${prop}`, this[prop]);
  //     this.send(JSON.stringify(this[prop], null, 2));
  //   } else {
  //     this.log.warn(`Show info missing prop!`);
  //     this.send(`Show info missing prop! (${Object.keys(this).join(', ')})`);
  //   }
  // }

  public help(): void {
    this.log.info(`HELP: Commands: ${this.commands.join(', ')}`);
    this.send(`HELP: Commands: ${this.commands.join(', ')}`);
  }

  public exit(msg = 'Goodbye.'): void {
    this.log.debug(`Exiting: ${msg}`);
    this.send(`${msg}\n`, false);

    this.socket.end();
    this.socket.destroy();

    this.disconnect();
  }

  public close(hasError: boolean) {
    this.log.debug(`Closing`, { hasError });
    this.disconnect();
  }

  public error(err: Error): void {
    this.log.error(err.message);
    this.disconnect();
  }

  public disconnect(): void {
    if (!this.disconnecting) {
      this.disconnecting = true;
      this.log.debug(`Disconnecting`);
      this.ctl.disconnect(this);
      this.emit('disconnect');

      if (this.relay) {
        this.relay.reset();
      }
    }
  }

  public ls(...args: string[]) {
    const { agents } = this.ctl;
    const lines = [...args].concat(['F11Agent List:'.underline]);

    this.log.info(`Running list command...`);

    if (agents.length) {
      this.ctl.agents.forEach((agent, index) => {
        // const cols = [ agent.signature?.cyan, `${agent.addrLocal.green} - ${agent.addrRemote.blue}`, agent.id.gray ];
        const cols = [ agent.addrLocal.green, agent.addrRemote.blue, agent.signature?.cyan];
        // const cols = [ agent.signature?.cyan, agent.addrRemote.blue, agent.id.gray ];
        lines.push(`\t[${index}]`.yellow + ' ' + cols.map(c => c.padEnd(28, ' ').padStart(30, ' ')).join(' | '));
      });

      lines.push('');
      lines.push(`Select an available agent with: "use [0-${this.ctl.agents.length - 1}]"`.italic);
    } else {
      lines.push(`\tNo available agents`);
    }

    this.send(lines.join(`\n`));
  }

  public kill(target: string) {
    const index = Number(target);

    if (!isNaN(index) && index >= 0 && index < this.ctl.agents.length) {
      const agent = this.ctl.agents[index];
      const msg = `Killing [${index}]: ${agent.signature} | ${agent.id}`;

      this.log.info(msg);
      this.send(msg.bgRed + `\n`, false);
      agent.exit();
      this.send(`Killed: [${index}] ${agent.id} (${agent.signature} | ${agent.address})`.gray);
    } else {
      this.send(`Missing/invalid agent target: ${target}`);
    }
  }

  public use(target: string) {
    const index = Number(target);

    if (!isNaN(index) && index >= 0 && index < this.ctl.agents.length) {
      const agent = this.ctl.agents[index];
      const msg = `Using [${index}]: ${agent.signature} | ${agent.id}`;

      // this.updatePrompt(agent);

      this.log.info(msg);
      this.send(msg.bgGreen + `\n\n`, false);
      this.relay = agent;
      agent.relay = this;
      agent.client = this;
      this.data(`\n`);
      // agent.send(`\r\n`);
    } else {
      this.send(`Missing/invalid agent target: ${target}`);
    }
  }

  public end() {
    this.log.debug(`Ending`);
    this.disconnect();
  }

  public updatePrompt(relay: F11Relay, cwd?: string): void {
    if (cwd && relay.info) {
      relay.info.cwd = cwd;
    }

    const promptParts = [relay.signature?.cyan, cwd?.yellow || relay.info?.cwd.yellow, this.ctl.prompt];

    this.prompt = promptParts.join(':');
  }
}
