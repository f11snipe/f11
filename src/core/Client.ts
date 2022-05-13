import 'colors';
// import { Socket } from 'net';
import tls, { PeerCertificate, TLSSocket, TLSSocketOptions } from 'tls';
import { IF11Client } from './types';
import { F11Controller } from './Controller';
import { F11Relay } from './Relay';

export class F11Client extends F11Relay implements IF11Client {
  public requireAuthorized = true;

  constructor(public ctl: F11Controller, public socket: TLSSocket, public quiet?: boolean) {
    super(ctl, socket, quiet ? undefined : ctl.prompt);
  }

  get docPath(): string {
    return `clients/${this.id}`;
  }

  public init(): void {
    super.init(['ls', 'use']);
    this.on('reset', this.showPrompt.bind(this));
  }

  public data(data: any): void {
    if (this.quiet) {
      this.log.info(`QUIET DATA: ${data}`);
      if (this.client) {
        this.client.write(data);
      }
    } else {
      super.data(data);
    }
  }

  public start(): void {
    this.log.info(`Starting F11Client...`);

    // this.signature = `sockz:client`;

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
    // this.signature = `sockz:client`;

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
