/// <reference types="node" />
import * as ssh2 from 'ssh2';
import * as net from 'net';
export declare type SocketAddress = {
    ip: string;
    port: number;
};
export declare class Node {
    private client;
    private opts;
    private connected;
    private address;
    private previousNode;
    constructor(opts: ssh2.ConnectConfig, previousNode: Node);
    getAddress(): SocketAddress;
    private wrappedForwardOut;
    getChannel(target: SocketAddress): Promise<ssh2.ClientChannel>;
    connect(): Promise<boolean>;
}
export declare class SSHTunnel {
    private nodes;
    private target;
    constructor(nodes: ssh2.ConnectConfig[], target: SocketAddress);
    getSocket(): Promise<ssh2.ClientChannel | net.Socket>;
}
