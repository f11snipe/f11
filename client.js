var tty = require('tty')
var net = require('net')

var sock = net.createConnection(7070)

sock.on('connect', function () {
  process.stdin.resume();
  tty.setRawMode(true)
})

process.stdin.pipe(sock)
sock.pipe(process.stdout)

sock.on('end', function () {
  tty.setRawMode(false)
  process.stdin.pause()
})