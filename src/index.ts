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

function wait(time: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

export type SocketAddress = {
  ip: string,
  port: number
}

export class Node {
  private client: ssh2.Client;
  private opts: ssh2.ConnectConfig;
  private connected: boolean;
  private address: SocketAddress;
  private previousNode: Node;
  constructor(opts: ssh2.ConnectConfig, previousNode: Node) {
    this.client = new ssh2.Client();
    this.opts = opts;
    this.connected = false;
    this.address = {ip: opts.host, port: opts.port || 22};
    this.previousNode = previousNode;
    this.client.on('close', () => {
      this.connected = false;
    });
    this.client.on('error', (err) => {
      if (err.message === "Keepalive timeout" || err.level === "client-timeout") {
        this.connected = false;
        this.connect();
      } else {
        throw err;
      }
    });
  }

  public getAddress(): SocketAddress {
    return this.address;
  }

  private wrappedForwardOut(target: SocketAddress): Promise<{err: Error, channel: ssh2.ClientChannel}> {
    const dummyAddress = generateLoopback();
    return new Promise(async (resolve) => {
      try {
        this.client.forwardOut(dummyAddress.ip, dummyAddress.port, target.ip, target.port, (err, channel) => {
          resolve({err, channel});
        });
      } catch (err) {
        resolve({err, channel: undefined});
      }
    });
  };

  public async getChannel(target: SocketAddress): Promise<ssh2.ClientChannel> {
    for (let i = 1; i <= 10; i += 1) {
      const {err, channel}: {err: Error, channel: ssh2.ClientChannel} = await this.wrappedForwardOut(target);
      if (err?.message === 'No response from server') {
        await wait(500);
        continue;
      } else if (err?.message === 'Not connected') {
        this.connected = false;
        await this.connect();
        await wait(500);
        continue;
      } else if (err) {
        throw err;
      } else {
        return channel;
      }
    }
    throw new Error('Failed to open channel');
  }

  public async connect(): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (this.connected) {
        return resolve(this.connected);
      }
      this.client.once('ready', () => {
        resolve(this.connected);
      });
      if (this.previousNode) {
        if (!this.previousNode.connected) this.previousNode.connect();
        const channel = await this.previousNode.getChannel(this.address);
        this.client.connect({...this.opts, sock: channel, keepaliveInterval: 500});
        this.connected = true;
      } else {
        this.client.connect({...this.opts, keepaliveInterval: 500});
        this.connected = true;
      }
    });
  }
}

export class SSHTunnel {
  private nodes: Node[];
  private target: SocketAddress;
  constructor(nodes: ssh2.ConnectConfig[], target: SocketAddress) {
    this.nodes = [];
    let previousNode: Node;
    for (const opts of nodes) {
      const node = new Node(opts, previousNode);
      previousNode = node;
      this.nodes.push(node);
    }
    this.target = target;
  }

  public async getSocket(): Promise<ssh2.ClientChannel | net.Socket> {
    let channel: ssh2.ClientChannel;
    const previousNode: Node = this.nodes[this.nodes.length-1];
    if (previousNode) {
      channel = await previousNode.getChannel(this.target);
      return channel;
    } else {
      return net.createConnection({
        host: this.target.ip,
        port: this.target.port
      });
    }
  }
}