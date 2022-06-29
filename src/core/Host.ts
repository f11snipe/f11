import 'colors';
import async from 'async';
import { F11Base } from './Base';
import { F11Agent } from './Agent';
import { F11Client } from './Client';
import { F11Controller } from './Controller';

export class F11Host extends F11Base implements F11Host {
  constructor(public ctl: F11Controller, public address: string, public hostname: string) {
    super();
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
}
