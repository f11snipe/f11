import colors from 'colors/safe';
import { UserInfo } from 'os';
import { EventEmitter } from 'events';
import { Socket } from 'net';
import { TLSSocket, PeerCertificate } from 'tls';
// import { WebSocket } from 'ws';
import { F11Controller } from './Controller';

export interface IF11Base extends EventEmitter {
  id: string;
  log: IF11Logger;
  info: IF11SystemInfo;
}

export interface IF11Options {
  config: string;
}

export interface IF11SystemInfo {
  cwd: string;
  os: {
    hostname: string;
    platform: string;
    release: string;
    type: string;
  };
  user: UserInfo<string>;
  context: {
    pkg?: any;
    node?: boolean;
    rails?: boolean;
    docker?: boolean;
    dockerCompose?: boolean;
    make?: boolean;
    makefile?: Buffer;
  };
  installPath: string;
}

export interface IF11Controller extends IF11Base {
  host: string;
  port: number;
}

export interface IF11Module extends IF11Base {
  num: number;
  name: string,
  href: string;
  path?: string,
  details: string
}

// export interface IF11WebApp {
//   ctl: F11Controller;
//   cors?: cors.CorsOptions;
//   server: Express;
// }

export interface IF11Connectable extends IF11Base {
  ctl: F11Controller;
  socket: TLSSocket | Socket;
  prompt?: string;
  signature?: string;
  commands: string[];
  forwards: string[];
  methods: string[];
  events: string[];
  relay?: IF11Connectable;
  disconnecting?: boolean;
  requireAuthorized?: boolean;
  clientAuthorized?: boolean;
  client?: IF11Connectable;

  get peer(): string;
  get cert(): PeerCertificate | undefined;
  get isAuthorized(): boolean;

  onData(data: any): void;

  authorized(): void;
  unauthorized(): void;
  write(msg: string, cb?: (err?: Error) => void): void;
  send(msg: string, keep?: boolean): void;
  init(commands?: string[], forwards?: string[]): void;
  ready(): void;
  reset(): void;
  data(data: any): void;
  reg(sig: string): void;
  ping(): void;
  // info(prop: string): void;
  help(): void;
  exit(msg?: string): void;
  close(hasError: boolean): void;
  error(err: Error): void;
  disconnect(): void;
  showPrompt(): void;
  updatePrompt(relay: IF11Connectable, cwd?: string): void;
  updateSig(src?: string): void;
}

export interface IF11Client {
  ls(...args: string[]): void;
  use(target: string): void;
  start(): void;
}

export interface IF11Agent {
  handle(action: string): void;
  notify(client: IF11Connectable): void;
  start(): void;
}

export interface IF11Host {
  ctl: F11Controller;
  address: string;

  get agents(): IF11Agent[];
  get clients(): IF11Client[];

  send(action: string): void;
  sendOne(action: string): void;
  sendAll(action: string): void;
}

export const F11_CMD = '#f11';
export type F11CmdTarget = 'agent' | 'host';
export type F11CmdHostAction = 'file' | 'proc';
export type F11CmdAgentAction = 'sig' | 'path' | 'user';
export type F11CmdAction = F11CmdHostAction | F11CmdAgentAction;

export interface IF11CmdAgentData {
  pid?: number | string;
  user?: string;
  host?: string;
  path?: string;
}

export interface IF11CmdHostDataFile {
  path?: string;
  perm?: string;
  body?: string;
}

export interface IF11CmdHostDataProc {
  pid?: number | string;
  cmd?: string;
  user?: string;
}

export interface IF11CmdHostData {
  hostname?: string;
  address?: string;
  uname?: string;
  files?: IF11CmdHostDataFile[];
  procs?: IF11CmdHostDataProc[];
}

// export type F11CmdHostData = IF11CmdHostDataFile | IF11CmdHostDataProc;
// export type F11CmdAgentData = IF11CmdAgentDataSig | IF11CmdAgentDataPath | IF11CmdAgentDataUser;
// export type F11CmdData = IF11CmdHostData | IF11CmdAgentData;

export interface IF11Cmd {
  target: F11CmdTarget;
  action: F11CmdAction;
  data: IF11CmdHostData | IF11CmdAgentData;
}

export interface IF11AgentCmd extends IF11Cmd {
  action: F11CmdAgentAction;
  data: IF11CmdAgentData;
}

export interface IF11HostCmd extends IF11Cmd {
  action: F11CmdHostAction;
  data: IF11CmdHostData;
}

export type F11LogThemeColor = 'ok' | 'get' | 'run' | 'end' | 'good' | 'warn' | 'info' | 'debug' | 'details' | 'module' | 'fatal' | 'prompt' | 'pending';
export type F11LogTextColor = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray' | 'grey' | 'brightRed' | 'brightGreen' | 'brightYellow' | 'brightBlue' | 'brightMagenta' | 'brightCyan' | 'brightWhite';
export type F11LogTextBgColor = 'bgBlack' | 'bgRed' | 'bgGreen' | 'bgYellow' | 'bgBlue' | 'bgMagenta' | 'bgCyan' | 'bgWhite' | 'bgGray' | 'bgGrey' | 'bgBrightRed' | 'bgBrightGreen' | 'bgBrightYellow' | 'bgBrightBlue' | 'bgBrightMagenta' | 'bgBrightCyan' | 'bgBrightWhite';
export type F11LogTextStyle = 'reset' | 'bold' | 'dim' | 'italic' | 'underline' | 'inverse' | 'hidden' | 'strikethrough' | 'rainbow' | 'zebra' | 'america' | 'trap' | 'random';
export type F11LogTextThemeValue = F11LogThemeColor | F11LogTextColor | F11LogTextBgColor | F11LogTextStyle;
export type F11LogMethod = (...args: any[]) => void;

export interface IF11LogTextTheme {
  [theme: string]: F11LogTextThemeValue | F11LogTextThemeValue[];
}

export const F11LogTheme: IF11LogTextTheme = {
  ok: ['green'],
  get: ['italic', 'green', 'underline'],
  run: ['italic', 'yellow', 'underline'],
  end: ['italic', 'red', 'bold', 'underline'],
  good: ['green'],
  warn: ['yellow'],
  info: ['black', 'bgCyan'],
  debug: ['dim', 'cyan', 'italic'],
  details: ['dim', 'cyan', 'italic'],
  module: ['red', 'bold', 'underline'],
  fatal: ['white', 'bgRed', 'bold'],
  prompt: ['trap', 'blue', 'bold'],
  pending: ['trap', 'blue', 'bold', 'strikethrough']
};

export interface IF11LogOptions {
  timestamp?: boolean;
  throws?: boolean;
  prefix?: string;
  theme?: string;
  color?: F11LogTextThemeValue;
}

export interface IF11LogOptionsMap {
  [name: string]: IF11LogOptions;
}

export interface IF11Logger {
  colorize: (args: any, color: F11LogTextThemeValue | string) => any;

  timestamp: () => string;

  log: (args: any, options?: IF11LogOptions) => void;
  out: (options?: IF11LogOptions) => F11LogMethod;
  info: F11LogMethod;
  warn: F11LogMethod;
  error: F11LogMethod;
  debug: F11LogMethod;
  success: F11LogMethod;
}
