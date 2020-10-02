import * as ssh2 from 'ssh2';
import * as net from 'net';

function randomInt(start: number, range: number): number {
  return Math.round(start + (Math.random()*range));
};
function generateLoopback(): SocketAddress {
  return {
    ip: `127.${randomInt(1, 253)}.${randomInt(1, 253)}.${randomInt(1, 253)}`,
    port: randomInt(40000, 10000)
  };
};

export type SocketAddress = {
  ip: string,
  port: number
}

export type Node = {
  client: ssh2.Client,
  opts: ssh2.ConnectConfig,
  connected: boolean,
  target: SocketAddress,
  address: SocketAddress
}

export class SSHTunnel {
  private nodes: Node[];
  private target: SocketAddress;
  
  constructor(nodes: ssh2.ConnectConfig[], target: SocketAddress) {
    this.nodes = [];
    let previousNode: Node;
    for (const opts of nodes) {
      const node = {
        client: new ssh2.Client(),
        opts,
        connected: false,
        target: target,
        address: {ip: opts.host, port: opts.port || 22}
      };
      node.client.on('close', () => {
        node.connected = false;
      });
      if (previousNode) previousNode.target = node.address;
      previousNode = node;
      this.nodes.push(node);
    }
    this.target = target;
  }

  
  private async getChannelFromClient(client: ssh2.Client, target: SocketAddress): Promise<ssh2.ClientChannel> {
    const dummyAddress = generateLoopback();
    return new Promise((resolve, reject) => {
      client.forwardOut(dummyAddress.ip, dummyAddress.port, target.ip, target.port, (err, channel) => {
        if (err) return reject(err);
        return resolve(channel);
      });
    });
  }

  public async getSocket(): Promise<ssh2.ClientChannel | net.Socket> {
    let channel: ssh2.ClientChannel;
    let previousNode: Node;
    for (const node of this.nodes) {
      if (!node.connected) {
        await new Promise(async (resolve, reject) => {
          node.client.once('ready', resolve);
          node.client.once('error', reject);
          if (previousNode) {
            channel = await this.getChannelFromClient(previousNode.client, node.address);
            node.client.connect({...node.opts, sock: channel, keepaliveInterval: 500});
          } else {
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
    } else {
      return net.createConnection({
        host: this.target.ip,
        port: this.target.port
      });
    }

  }
}