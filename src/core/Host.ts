import 'colors';
import async from 'async';
import { IF11CmdHostData, IF11CmdHostDataProc } from './types';
import { F11Base } from './Base';
import { F11Agent } from './Agent';
import { F11Client } from './Client';
import { F11Controller } from './Controller';

export class F11Host extends F11Base implements F11Host, IF11CmdHostData {
  public files = {};
  public procs: IF11CmdHostDataProc[] = [];

  constructor(public ctl: F11Controller, public address: string, public hostname: string) {
    super();

    // setInterval(() => {
    //   this.log.debug('HOST FILES LIST', this.files);
    // }, 5000);
  }

  get agents(): F11Agent[] {
    return this.ctl.agents.filter(agent => agent.addrRemote.indexOf(this.address) === 0);
  }

  get clients(): F11Client[] {
    return this.ctl.clients.filter(client => client.addrRemote.indexOf(this.address) === 0);
  }

  public send(action: string, cb?: (err?: Error | null) => void): void {
    this.sendAny(action, cb);
  }

  public sendOne(index: number, action: string, cb?: (err?: Error | null) => void): void {
    if (this.agents[index]) {
      this.agents[index].write(`${action}\n`, cb);
    }
  }

  public sendAny(action: string, cb?: (err?: Error | null) => void): void {
    this.sendOne(0, action, cb);
  }

  public sendAll(action: string, cb?: (err?: Error | null) => void): void {
    async.each(this.agents, (agent, next) => {
      agent.write(`${action}\n`, next);
    }, (err) => {
      if (cb) cb(err);
    });
  }

  public sendAnyIn(timeout: number, action: string, cb?: (err?: Error | null) => void): void {
    setTimeout(() => {
      this.sendAny(action, cb);
    }, timeout);
  }

  public sendAllIn(timeout: number, action: string, cb?: (err?: Error | null) => void): void {
    setTimeout(() => {
      this.sendAll(action, cb);
    }, timeout);
  }
}
