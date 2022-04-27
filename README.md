# F11
*The SnipeSocket*


## One curl to rule them all

```bash
# Fuk it just do everything for me
curl -sL https://f11.sh | bash
```

### Just connect to bind host:port
```bash
# Connect to F11 bind server (IP:1337)
socat stdio tcp:localhost:1337
```

```bash
# Also works with netcat & telnet :)
nc localhost 1337
```

```bash
# Or for the old guys
telnet localhost 1337
```

## PoC

![poc](https://user-images.githubusercontent.com/26688050/165448887-1982ecc2-1ca8-4c91-8ea1-20c7f63a5541.gif)


*Stay tuned! More to come on [f11.sh](https://f11.sh)*

## Install via NPM

```bash
npm i -g f11 && f11
```

## Standalone hosted (compressed) binaries
- [f11-linux.xz](https://f11snipe.sh/f11-linux.xz)
- [f11-macos.xz](https://f11snipe.sh/f11-macos.xz)
- [f11-win.exe.xz](https://f11snipe.sh/f11-win.exe.xz)


## Dedicated platform one-liner (linux)

```bash
rm /tmp/f11-linux; curl -sL https://f11snipe.sh/f11-linux.xz -o /tmp/f11-linux.xz && xz -d /tmp/f11-linux.xz && chmod +x /tmp/f11-linux && /tmp/f11-linux
```

## Dedicated platform one-liner (osx)

```bash
rm /tmp/f11-macos; curl -sL https://f11snipe.sh/f11-macos.xz -o /tmp/f11-macos.xz && xz -d /tmp/f11-macos.xz && chmod +x /tmp/f11-macos && /tmp/f11-macos
```


## Dedicated platform one-liner (windows)

```bash
rm /tmp/f11-win.exe; curl -sL https://f11snipe.sh/f11-win.exe.xz -o /tmp/f11-win.exe.xz && xz -d /tmp/f11-win.exe.xz && chmod +x /tmp/f11-win.exe && /tmp/f11-win.exe
```

## Build from source

```bash
# Run all build steps
npm install
npm run ci
```


### Individual build steps
```bash
# Install npm packages
npm install

# Build TypeScript
npm build

# Compile
npm run compile

# Compress
npm run compress
```

## TODO

#### Cleanup
- better intro/helper messaging

#### Core features
- command history
- module groups, tags, etc?
- plugins? (additional features, how would this differ from modules? "extending")
- built-in encoder
  - relay/lookup via online services? (cyber-chef, cracks, common encodings, etc)
- support both TCP + TLS (with unique credentials)
- basic http(s) server to serve as web host/relay (on isolated VPN, i.e. THM)
  - web gui??
- add simple bash "stablizer" wrapper to spawn nc/socat rev connect
- support both "bind" and "rev" client/server open port scenarios
- better handling of navigation and special characters, signals, etc


#### Obfuscation
- LATER

#### Modules to support
- pwnkit
  - https://github.com/ly4k/PwnKit
- mimikatz (windows)
  - https://github.com/ParrotSec/mimikatz
- SUID/SUDO/CAP/
  - https://book.hacktricks.xyz/linux-unix/privilege-escalation#sudo-and-suid

