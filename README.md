# f11
*revshellpal*

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