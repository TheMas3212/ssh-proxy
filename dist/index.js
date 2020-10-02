"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSHTunnel = void 0;
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
class SSHTunnel {
    constructor(nodes, target) {
        this.nodes = [];
        let previousNode;
        for (const opts of nodes) {
            const node = {
                client: new ssh2.Client(),
                opts,
                connected: false,
                target: target,
                address: { ip: opts.host, port: opts.port || 22 }
            };
            node.client.on('close', () => {
                node.connected = false;
            });
            if (previousNode)
                previousNode.target = node.address;
            previousNode = node;
            this.nodes.push(node);
        }
        this.target = target;
    }
    async getChannelFromClient(client, target) {
        const dummyAddress = generateLoopback();
        return new Promise((resolve, reject) => {
            client.forwardOut(dummyAddress.ip, dummyAddress.port, target.ip, target.port, (err, channel) => {
                if (err)
                    return reject(err);
                return resolve(channel);
            });
        });
    }
    async getSocket() {
        let channel;
        let previousNode;
        for (const node of this.nodes) {
            if (!node.connected) {
                await new Promise(async (resolve, reject) => {
                    node.client.once('ready', resolve);
                    node.client.once('error', reject);
                    if (previousNode) {
                        channel = await this.getChannelFromClient(previousNode.client, node.address);
                        node.client.connect({ ...node.opts, sock: channel, keepaliveInterval: 500 });
                    }
                    else {
                        node.client.connect(node.opts);
                    }
                });
                node.connected = true;
            }
            previousNode = node;
        }
        if (previousNode) {
            const dummyAddress = generateLoopback();
            channel = await this.getChannelFromClient(previousNode.client, this.target);
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