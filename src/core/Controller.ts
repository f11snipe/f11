import 'colors';
import fs from 'fs';
import path from 'path';
import { Socket } from 'net';
import { Server, TLSSocket, TLSSocketOptions } from 'tls';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, ServerResponse as WebServerResponse } from 'http';
import { Server as WebServer } from 'https';

import { F11Base } from './Base';
import { F11Relay } from './Relay';
import { F11Agent } from './Agent';
import { F11Client } from './Client';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_WEB_PORT = 4040;
const DEFAULT_AGENT_PORT = 1111;
const DEFAULT_CLIENT_PORT = 2222;
const DEFAULT_PROMPT = `sockz> `;

const {
  SERVER_HOST_NAME = 'localhost',
  SERVER_CERT_NAME = 'server.certificate.pem',
  SERVER_KEY_NAME = 'server.clientKey.pem',
  SERVER_CA_NAME = 'server.certificate.pem',
  STRIPE_SECRET_KEY
} = process.env;

export class F11Controller extends F11Base {
  public web: WebServer;
  public wss: WebSocketServer;
  public agentServer: Server;
  public clientServer: Server;

  public agents: F11Agent[] = [];
  public clients: F11Client[] = [];

  constructor(
    public host = DEFAULT_HOST,
    public agentPort = DEFAULT_AGENT_PORT,
    public clientPort = DEFAULT_CLIENT_PORT,
    public prompt = DEFAULT_PROMPT
  ) {
    super();

    /**
     * Other constructor things...
     */
  }

  public tlsOptions(cert: string, key: string, caList?: string, requestCert = true, rejectUnauthorized = true): TLSSocketOptions {
    const certsDir = path.join(__dirname, '..', 'certs');

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

    this.agentServer = new Server(this.tlsOptions(SERVER_CERT_NAME, SERVER_KEY_NAME, SERVER_CA_NAME, true, false));
    this.clientServer = new Server(this.tlsOptions(SERVER_CERT_NAME, SERVER_KEY_NAME, SERVER_CA_NAME, true, true));
  }

  public listen(): void {
    this.agentServer.listen(this.agentPort, this.host, () => {
      this.log.info(`F11Agent server listening: ${this.host}:${this.agentPort}`);
    });

    this.clientServer.listen(this.clientPort, this.host, () => {
      this.log.info(`F11Client server listening: ${this.host}:${this.clientPort}`);
    });
  }

  public handle(): void {
    this.agentServer.on('secureConnection', this.connectAgent.bind(this));
    this.clientServer.on('secureConnection', this.connectClient.bind(this));
  }

  public debug(): void {
    this.log.debug(`${this.agents.length} F11Agent(s) | ${this.clients.length} F11Client(s)`);
  }

  public connectAgent(socket: TLSSocket): void {
    const agent = new F11Agent(this, socket);
    agent.init();
    this.agents.push(agent);
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
