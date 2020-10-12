"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSHTunnel = exports.Node = void 0;
const ssh2 = require("ssh2");
const net = require("net");
function randomInt(start, range) {
    return Math.round(start + (Math.random() * range));
}
;
function generateLoopback() {
    return {
        ip: `127.${randomInt(1, 253)}.${randomInt(1, 253)}.${randomInt(1, 253)}`,
        port: randomInt(40000, 10000)
    };
}
;
function wait(time) {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}
class Node {
    constructor(opts, previousNode) {
        this.client = new ssh2.Client();
        this.opts = opts;
        this.connected = false;
        this.address = { ip: opts.host, port: opts.port || 22 };
        this.previousNode = previousNode;
        this.client.on('close', () => {
            console.log('node disconnect', this.address);
            this.connected = false;
        });
        this.client.on('error', (err) => {
            if (err.message === "Keepalive timeout" || err.level === "client-timeout") {
                console.log("Keepalive Timeout, reconnecting", this.address.ip, this.address.port);
                this.connected = false;
                this.connect();
            }
            else {
                console.error('ERROR ssh client', this.address.ip, this.address.port, err);
            }
        });
    }
    getAddress() {
        return this.address;
    }
    wrappedForwardOut(target) {
        const dummyAddress = generateLoopback();
        return new Promise(async (resolve) => {
            try {
                this.client.forwardOut(dummyAddress.ip, dummyAddress.port, target.ip, target.port, (err, channel) => {
                    resolve({ err, channel });
                });
            }
            catch (err) {
                resolve({ err, channel: undefined });
            }
        });
    }
    ;
    async getChannel(target) {
        for (let i = 1; i <= 10; i += 1) {
            const { err, channel } = await this.wrappedForwardOut(target);
            if ((err === null || err === void 0 ? void 0 : err.message) === 'No response from server') {
                await wait(500);
                continue;
            }
            else if ((err === null || err === void 0 ? void 0 : err.message) === 'Not connected') {
                this.connected = false;
                await this.connect();
                await wait(500);
                continue;
            }
            else if (err) {
                throw err;
            }
            else {
                return channel;
            }
        }
        throw new Error('Failed to open channel');
    }
    async connect() {
        return new Promise(async (resolve) => {
            if (this.connected) {
                return resolve(this.connected);
            }
            this.client.once('ready', () => {
                resolve(this.connected);
            });
            if (this.previousNode) {
                if (!this.previousNode.connected)
                    this.previousNode.connect();
                const channel = await this.previousNode.getChannel(this.address);
                this.client.connect({ ...this.opts, sock: channel, keepaliveInterval: 500 });
                this.connected = true;
            }
            else {
                this.client.connect({ ...this.opts, keepaliveInterval: 500 });
                this.connected = true;
            }
        });
    }
}
exports.Node = Node;
class SSHTunnel {
    constructor(nodes, target) {
        this.nodes = [];
        let previousNode;
        for (const opts of nodes) {
            const node = new Node(opts, previousNode);
            previousNode = node;
            this.nodes.push(node);
        }
        this.target = target;
    }
    async getSocket() {
        let channel;
        const previousNode = this.nodes[this.nodes.length - 1];
        if (previousNode) {
            channel = await previousNode.getChannel(this.target);
            return channel;
        }
        else {
            return net.createConnection({
                host: this.target.ip,
                port: this.target.port
            });
        }
    }
}
exports.SSHTunnel = SSHTunnel;
//# sourceMappingURL=index.js.map