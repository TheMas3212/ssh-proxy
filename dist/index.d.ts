/// <reference types="node" />
import * as ssh2 from 'ssh2';
import * as net from 'net';
export declare type SocketAddress = {
    ip: string;
    port: number;
};
export declare type Node = {
    client: ssh2.Client;
    opts: ssh2.ConnectConfig;
    connected: boolean;
    target: SocketAddress;
    address: SocketAddress;
};
export declare class SSHTunnel {
    private nodes;
    private target;
    constructor(nodes: ssh2.ConnectConfig[], target: SocketAddress);
    private getChannelFromClient;
    getSocket(): Promise<ssh2.ClientChannel | net.Socket>;
}
