import 'colors';
import fs from 'fs';
import tls, { TLSSocket } from 'tls';
import path from 'path';
// import shell from 'shelljs';
import { Socket } from 'net';
import { IF11Agent } from './types';
import { F11Controller } from './Controller';
import { F11Relay } from './Relay';
import { F11Host } from './Host';

const {
  AGENT_CERT_NAME = 'agent.certificate.pem',
  AGENT_KEY_NAME = 'agent.clientKey.pem',
  AGENT_CA_LIST = '',

  // Ssshhhh ... secret env var 😉 (override to open $RICKROLL webpage on "rickroll" cmd)
  RICKROLL = 'https://www.youtube.com/watch?v=oHg5SJYRHA0'
} = process.env;

const STABALIZE = `python3 -c 'import pty; pty.spawn("/bin/bash")' || python -c 'import pty; pty.spawn("/bin/bash")' || script -qc /bin/bash /dev/null`;

export class F11Agent extends F11Relay implements IF11Agent {
  public host: F11Host;
  public listener?: boolean;
  public active = false;
  public requireAuthorized = false;

  constructor(public ctl: F11Controller, public socket: TLSSocket | Socket) {
    super(ctl, socket);

    if (socket.remoteAddress) {
      this.host = ctl.findOrCreateHost(socket.remoteAddress);
    }
  }

  get docPath(): string {
    return `agents/${this.id}`;
  }

  public init(): void {
    super.init(['registered']);
  }

  public registered(): void {
    this.ctl.clients.forEach(this.notify.bind(this));
  }

  public notify(client: F11Relay): void {
    if (!client.relay) {
      client.ls(`\n** New F11Agent Connected! **`.bgGreen);
    }
  }

  public reset(): void {
    this.prompt = this.ctl.prompt;

    if (this.relay) {
      this.log.debug(`Exit relay:`, this.relay.signature, this.relay.id);
      delete this.relay;
    }

    if (this.client) {
      this.log.debug(`Exit client:`, this.client.signature, this.client.id);
      delete this.client;
    }

    this.emit('reset');
  }

  public data(data: any): void {
    const body = data.toString().trim();
    const lines = body.split(`\n`);

    lines.forEach(line => {
      if (/^#f11\|/i.test(line)) {
        const info: { user?: string, path?: string, host?: string } = {};
        const [_, action, content] = line.split('|');
        content.split(';').forEach(chunk => {
          const [key, val] = chunk.split(':');
          info[key] = val;
        });

        if (info.host) {
          this.host.hostname = info.host;
        }

        if (/^sig/i.test(action)) {
          this.signature = `${info.user}@${info.host}:${info.path}`;
        }
      }
    });

    if (!this.active) {
      this.active = true;
      this.log.success(`Active: ${this.addrLocal} <> ${this.addrRemote}`);

      setTimeout(() => {
        this.registered();
      }, 100);
    }

    if (this.listener) {
      this.log.debug(`Handling data as listener: ${data}`);
      this.handle(body);
    } else {
      if (this.relay) {
        this.relay.write(data);
      }

      if (/^ *exit *$/.test(body)) {
        this.active = false;
        this.end();
      }
    }
  }

  public stable(cmd?: string): void {
    this.send(cmd || STABALIZE);
  }

  public handle(action: string): void {
    let response = '';

    this.log.debug(`Handle action: ${action}`);

    if (action === this.ctl.prompt.trim()) {
      this.log.warn(`Ignoring request to exec prompt: ${action}`);
    } else if (action === 'ping') {
      response = 'pong';
    } else if (action === 'stop') {
      this.socket.end();
      return;
    } else if (/rickroll/i.test(action)) {
      // shell.exec(`python3 -m webbrowser "${RICKROLL}"`);
      this.log.info(`python3 -m webbrowser "${RICKROLL}"`)
      response = `Rick is rolling ...`;
    } else if (action === 'info') {
      response = JSON.stringify(this.info, null, 2);
    } else {
      // const res = shell.exec(action, { silent: true });
      this.log.info(action);
      const [cmd, ...args] = action.split(' ').map((str) => str.trim());

      // if (res?.code === 0 && cmd === 'cd' && args.length) {
      //   const [dest] = args;
      //   const target = /^\./.test(dest) ? path.join(process.cwd(), dest) : dest;

      //   if (fs.existsSync(target)) {
      //     process.chdir(target);
      //     response = `chdir ${process.cwd()}`;

      //     this.log.warn(`Changed working directory: ${process.cwd()}`);
      //   } else {
      //     response = `${action} [FAIL] (target ${target} does not exist)`;
      //   }
      // } else {
      //   if (res && res.stdout) {
      //     response = res.stdout;
      //   }

      //   if (res && res.stderr) {
      //     response += res.stderr;
      //   }

      //   response += `\n${action}`;

      //   if (res && res.code === 0) {
      //     response += ` [OK]`.green;
      //   } else {
      //     response += ` [FAIL] (code: ${res ? res.code : 'No Response'})`.red;
      //   }
      // }
    }

    this.write(response);
  }

  public start(): void {
    this.listener = true;
    this.log.info(`Starting F11Agent...`);

    this.signature = `${this.info?.user.username}@${this.info?.os.hostname}`;

    this.socket = tls.connect(
      {
        ...this.ctl.tlsOptions(AGENT_CERT_NAME, AGENT_KEY_NAME, AGENT_CA_LIST, true, false),
        host: this.ctl.host,
        port: this.ctl.agentPort
      },
      () => {
        this.log.info(`F11Agent connected to controller: ${this.ctl.host}:${this.ctl.agentPort}`);
        this.init();
        this.write(`reg ${this.signature}`);
      }
    );
  }
}
