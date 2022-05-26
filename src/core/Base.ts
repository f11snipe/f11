import 'colors';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

import { IF11Base, IF11SystemInfo, F11LogTheme } from './types';
import { F11Logger } from './Logger';

const DEFAULT_BASE_DIR = '/tmp/.f11';

export class F11Base extends EventEmitter implements IF11Base {
  public log: F11Logger;
  public info: IF11SystemInfo;

  constructor(
    public id = uuidv4(),
    public basePath = DEFAULT_BASE_DIR,

  ) {
    super();
    this.id = id || uuidv4();
    this.log = new F11Logger(`${this.id} (${this.constructor.name})`, F11LogTheme);
    this.load();
  }

  load(): void {
    this.info = {
      cwd: process.cwd(),
      os: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        type: os.type()
      },
      user: os.userInfo(),
      context: {},
      installPath: path.join(__dirname, '..')
    };
  }
}
