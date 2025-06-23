"use strict";
exports.__esModule = true;
var net = require("net");
var _a = process.env, _b = _a.RHOST, RHOST = _b === void 0 ? '127.0.0.1' : _b, _c = _a.RPORT, RPORT = _c === void 0 ? '80' : _c;
var MAX_WAIT = 600000; // 10 minutes
var INTERVAL = 100; // 100ms
var TIMEOUT = 2000;
var report = {};
var categorize = function (data) {
    var cats = ['FTP', 'SSH', 'TELNET', 'MYSQL', 'SMB', 'SAMBA', 'RPC', 'BIND'];
    return cats.filter(function (cat) { return (new RegExp(cat, 'im')).test(data); });
};
var testPort = function (port) {
    return new Promise(function (resolve, reject) {
        var sock = new net.Socket();
        var onError = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            sock.destroy();
            reject(new Error("Socket error: ".concat(port)));
        };
        sock.setTimeout(TIMEOUT);
        sock.once('error', onError);
        sock.once('timeout', onError);
        sock.connect(port, RHOST, function () {
            report[port] = "[open] ".concat(port, "/tcp ").padEnd(18);
            sock.on('data', function (data) {
                report[port] += " :: [".concat(categorize(data.toString()).join(', '), "]").padEnd(16);
                report[port] += " :: ".concat(data.toString().split("\n")[0]);
            });
            sock.end();
            resolve();
        });
    });
};
var waitForPort = function (port, cb) {
    testPort(port).then(function (res) {
        console.log("OPEN ".concat(port));
        cb();
    })["catch"](function (err) {
        setTimeout(function () {
            waitForPort(port, cb);
        }, INTERVAL);
    });
};
var runScan = function () {
    var started = Date.now();
    var port = parseInt(RPORT, 10);
    console.log("Waiting for ".concat(RHOST, " port ").concat(port, " to open..."));
    waitForPort(port, function () {
        var finished = Date.now();
        var duration = finished - started;
        var seconds = (duration / 1000).toFixed(2);
        console.log(Object.values(report).join("\n"));
        console.log("Finished (".concat(port, " open in ").concat(seconds, "s)"));
    });
};
runScan();
