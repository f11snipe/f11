# f11
*revshellpal*


### Install via NPM

```bash
npm i -g f11
f11
```


### Standalone one-liner

```bash
rm /tmp/f11; curl -sL https://f11snipe.sh/f11.xz -o /tmp/f11.xz && xz -d /tmp/f11.xz && chmod +x /tmp/f11 && /tmp/f11
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
