import 'colors';
import fs from 'fs';
import tls, { TLSSocket } from 'tls';
import path from 'path';
// import shell from 'shelljs';
import { Socket } from 'net';
import { F11_CMD, IF11Agent, IF11Cmd, IF11AgentCmd, IF11HostCmd, F11CmdTarget, IF11CmdAgentData, F11CmdAction } from './types';
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
  public meta?: IF11CmdAgentData;
  public host: F11Host;
  public listener?: boolean;
  public active = false;
  public stablized = false;
  // public interval = 30000;
  public requireAuthorized = false;

  public lastLine?: string;

  // private intervalRef = null;

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
    this.updateSig('Agent.init()');
  }

  public sigCmd(): string {
    const data: IF11CmdAgentData = {
      pid: '\\"pid\\":\\"$$\\"',
      host: '\\"host\\":\\"`hostname`\\"',
      path: '\\"path\\":\\"`pwd`\\"',
      user: '\\"user\\":\\"`whoami`\\"',
      shell: '\\"shell\\":\\"`basename $SHELL`\\"',
    }

    return `data=$(echo "{${Object.values(data).join(',')}}");echo "${F11_CMD}|agent|sig|$(echo $data | base64 -w0)"`;
  }

  public updateSig(src = 'none'): void {
    const cmd = this.sigCmd();
    this.log.debug(`Sending cmd to update agent signature`, { src, cmd })
    this.write(`${cmd}\n`);
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

  public handleF11Cmd(line: string): void {
    if (line.trim().indexOf(F11_CMD) > 0) return;

    try {
      const [_, target, action, content] = line.split('|').map(s => s.trim());

      if (!target || !action || !content) {
        throw new Error(`Invalid F11 Command: '${line}'`);
      }

      const payload: IF11Cmd = {
        target: target as F11CmdTarget,
        action: action as F11CmdAction,
        data: JSON.parse(Buffer.from(content, 'base64').toString())
      };

      switch (target as F11CmdTarget) {
        case 'agent':
          const agentCmd = payload as IF11AgentCmd;
          this.meta = agentCmd.data;

          switch (agentCmd.action) {
            case 'sig':
              this.signature = `${agentCmd.data.user}@${agentCmd.data.host}`;

              if (agentCmd.data.path) {
                this.signature += `:${agentCmd.data.path}`;
              }

              if (agentCmd.data.shell) {
                this.signature = `[${agentCmd.data.shell}] ${this.signature}`;
              }

              if (agentCmd.data.host) {
                this.host.hostname = agentCmd.data.host;
              }
              break;
            case 'path':
              break;
            case 'user':
              break;
            default:
              break;
          }
          break;
        case 'host':
          const hostCmd = payload as IF11HostCmd;
          switch (hostCmd.action) {
            case 'file':
              break;
            case 'proc':
              break;
            default:
              break;
          }
          break;
        default:
          break;
      }
    } catch (err) {
      this.log.warn('F11 Cmd Error', err);
    }
  }

  public data(data: any): void {
    const body = data.toString().trim();
    const lines = body.split(`\n`);

    this.log.debug('Agent.data() - LINES', lines);

    lines.forEach((line, index) => {
      if (line.trim().includes(F11_CMD)) {
        lines.splice(index, 1); // Remove cmd lines from relay writes
        this.handleF11Cmd(line);
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

      if (/^ *exit *$/.test(body)) {
        this.active = false;
        this.end();
      } else if (this.relay) {
        // this.log.debug('Should send agent sig?', this.lastLine?.includes(this.signature), this.lastLine, this.signature);

        // TODO: Better sync control flow for dynamic agent prompts (without stable)
        // if (!this.stablized && (!this.lastLine?.includes(this.signature) || (!!this.lastLine && !lines.length))) {
        //   lines.push(`\n${this.signature.gray}$ `);
        // }

        this.relay.write(lines.join(`\n`));
        this.lastLine = lines[lines.length - 1];
      }
    }

  }

  public stable(cmd?: string): void {
    this.write((cmd || STABALIZE) + `\n`);
    this.stablized = true;
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
