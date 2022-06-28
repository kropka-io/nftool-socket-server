import fetch from 'node-fetch';
import { Connector } from "@rarible/connector";
import {WalletConnectConnectionProvider} from "@rarible/connector-walletconnect";
import {toContractAddress, toUnionAddress } from "@rarible/types";
import {PrepareMintRequest} from "@rarible/sdk/build/types/nft/mint/prepare-mint-request.type";
import {mapEthereumWallet} from '@rarible/connector-helper';
import {createRaribleSdk} from '@rarible/sdk';

const { LocalStorage } = require('node-localstorage');
const FormData = require('form-data');

const API_KEY = 'bd0d345d2b0565a670f5';
const SECRET_API_KEY = 'c07b7d17a545a96a7646a83a6459784afe97255027695b85f308b66721ad67f9';
const CONTRACT_ADDRESS = '0xc9154424B823b10579895cCBE442d41b9Abd96Ed';
const SOCKET_STATUS_CHANEL = 'statuses';
const STORAGE_KEY = 'rarible_zalupa';

enum Statuses {
    CONNECT_ACCOUNT_LAUNCHED = 'CONNECT_ACCOUNT_LAUNCHED',
    FILE_UPLOADED_TO_IPFS = 'FILE_UPLOADED_TO_IPFS',
    MINTED_AND_PUT_ON_SELL = 'MINTED_AND_PUT_ON_SELL',
    ACCOUNT_CONNECTED = 'ACCOUNT_CONNECTED',
    ACCOUNT_DISCONNECTED = 'ACCOUNT_DISCONNECTED',
    LAUNCH_WALLET = 'LAUNCH_WALLET',
    LOAD_TO_IPFS_ERROR = 'LOAD_TO_IPFS_ERROR',
    MINT_ERROR = 'MINT_ERROR',
    SELL_ERROR = 'SELL_ERROR'
};

export const setup = () => {
    // Setup
    //@ts-ignore
    global.FormData = FormData;
    //@ts-ignore
    global["window"] = {
        //@ts-ignore
        fetch: fetch,

        //@ts-ignore
        localStorage: new LocalStorage('./scratch'),
        //@ts-ignore
        dispatchEvent: () => {
        },
        addEventListener: () => {
        }
    };
    //@ts-ignore
    global.CustomEvent = function CustomEvent() {
        return;
    };
}

export const getSocketStatusChannel = (deviceId: string): string => {
    return `${SOCKET_STATUS_CHANEL}_${deviceId}`;
}

export const connect = async (connector: any) => {
    const option = (await connector.getOptions())[0];

    console.log(option);

    await connector.connect(option);
};

export const getConnector = async (deviceId: string, socket: any) => {
    const socketChannel = getSocketStatusChannel(deviceId);

    const walletConnect = mapEthereumWallet(new WalletConnectConnectionProvider({
        bridge: "https://bridge.walletconnect.org",
        clientMeta: {
            description: "WalletConnect NodeJS Client",
            url: "https://nodejs.org/en/",
            icons: ["https://nodejs.org/static/images/logo.svg"],
            name: "WalletConnect",
        },
        rpc: {
            1: "https://node-mainnet.rarible.com",
            3: "https://node-ropsten.rarible.com",
            4: "https://node-rinkeby.rarible.com",
            137: "https://matic-mainnet.chainstacklabs.com",
        },
        chainId: 1,
        qrcode: true,
        storageId: `${STORAGE_KEY}_${deviceId}`,
        qrcodeModal: {
            async open(uri: string, cb: any, opts?: any) {
                socket.emit(socketChannel, {
                    status: Statuses.CONNECT_ACCOUNT_LAUNCHED,
                    message: {
                        link: uri,
                    },
                });

                console.log(uri)
            },
            async close() {
                console.log('closed method was called ')
                return 'darova'
            }
        },
        signingMethods: [
            'eth_sendTransaction',
            'eth_signTransaction',
            'eth_sign',
            'eth_signTypedData',

            'eth_signTypedData_v1',
            'eth_signTypedData_v2',
            'eth_signTypedData_v3',
            'eth_signTypedData_v4',
            'personal_sign',
        ],
    }))

    return Connector.create(walletConnect);
};

export const connectWallet = async (deviceId: string, socket: any) => {
    const connector = await getConnector(deviceId, socket);

    const socketChannel = getSocketStatusChannel(deviceId);

    connector.connection.subscribe(async (con) => {
            console.log("connection: " + con.status);

            if (con.status === "connected") {
                console.log('local storage after connect' + JSON.stringify(window.localStorage.getItem(`${STORAGE_KEY}_${deviceId}`)))
                // window.localStorage.setItem('walletconnect', '');

                socket.emit(socketChannel, {
                    status: Statuses.ACCOUNT_CONNECTED,
                    message: {
                        address: con.connection.address,
                    },
                });
            }
        }
    )

    await connect(connector)
};

export const disconnectWallet = async (deviceId: string, socket: any) => {
    window.localStorage.setItem(`${STORAGE_KEY}_${deviceId}`, '');

    const socketChannel = getSocketStatusChannel(deviceId);

    socket.emit(socketChannel, {
        status: Statuses.ACCOUNT_DISCONNECTED,
    });
};

export const mintAndSell = async (
    deviceId: string,
    name: string = 'Default name',
    description: string = 'Default description',
    price: string = '1',
    royalty: string = '1',
    file: any,
    socket: any,
) => {
    const connector = await getConnector(deviceId, socket);

    const socketChannel = getSocketStatusChannel(deviceId);

    connector.connection.subscribe(async (con) => {
        if (con.status === "connected") {
            console.log("connection: " + con.status);
            // prod
            const collection = `ETHEREUM:${CONTRACT_ADDRESS}`;
            // @ts-ignore
            // @ts-ignore
            const sdk = createRaribleSdk(con.connection.wallet, "prod", {
                apiClientParams: {
                    fetchApi: fetch,
                },
            });
            const tokenId = await sdk.nft.generateTokenId({
                collection: toContractAddress(collection),
                minter: toUnionAddress(`ETHEREUM:${con.connection.address}`),
            })
            console.log(tokenId);


            let uri;
            try {
                const jsonImgUrl = await uploadJsonToIpfs(
                    name,
                    description,
                    file,
                    // @ts-ignore
                    tokenId?.tokenId,
                )

                socket.emit(socketChannel, {
                    status: Statuses.FILE_UPLOADED_TO_IPFS,
                    message: {
                        link: jsonImgUrl,
                    },
                });
            } catch (err) {
                console.log(Statuses.LOAD_TO_IPFS_ERROR)
                console.dir(err);

                socket.emit(socketChannel, {
                    status: Statuses.LOAD_TO_IPFS_ERROR,
                    message: JSON.stringify(err),
                });
                throw err;
            }


            let mintSubmitResponse;
            try {
                const mintRequest: PrepareMintRequest = {
                    // @ts-ignore
                    collectionId: toContractAddress(collection),
                    tokenId,
                };
                const mintResponse = await sdk.nft.mint(mintRequest);

                socket.emit(socketChannel, { status: Statuses.LAUNCH_WALLET });

                console.log('ipfs url ' + uri);
                console.log(`the price is ${parseFloat(price)}`);
                console.log(`the royalties is ${parseFloat(royalty)}`);

                mintSubmitResponse = await mintResponse.submit({
                    uri,
                    supply: 1,
                    lazyMint: true,
                    creators: [
                        {
                            account: toUnionAddress(`ETHEREUM:${con.connection.address}`),
                            value: 10000,
                        },
                    ],
                    royalties: [{
                        account: toUnionAddress(`ETHEREUM:${con.connection.address}`),
                        value: parseFloat(royalty) * 100 || 1,
                    }],
                });
            } catch (err) {
                console.log(Statuses.MINT_ERROR);
                console.dir(err);

                socket.emit(socketChannel, {
                    status: Statuses.MINT_ERROR,
                    message: JSON.stringify(err),
                });

                throw err;
            }


            try {
                socket.emit(socketChannel, { status: Statuses.LAUNCH_WALLET });
                const prepareSellResponse = await sdk.order.sell({itemId: mintSubmitResponse.itemId});
                await prepareSellResponse.submit({
                    amount: 1,
                    price: parseFloat(price),
                    currency: {
                        "@type": "ETH",
                    },
                });
                console.log('EVERYTHING COMPLETED');

                socket.emit(socketChannel, {
                    status: Statuses.MINTED_AND_PUT_ON_SELL,
                    message: {
                        link: `https://rarible.com/token/0xc9154424B823b10579895cCBE442d41b9Abd96Ed:${tokenId?.tokenId}`,
                    },
                });
            } catch (err) {
                console.log(Statuses.SELL_ERROR);
                console.dir(err);

                socket.emit(socketChannel, {
                    status: Statuses.SELL_ERROR,
                    message: JSON.stringify(err),
                });

                throw err;
            }
        }
    });

    await connect(connector)
};

export const uploadFileToIpfs = async (file: any): Promise<string> => {
    const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
    let data = new FormData();

    data.append('file', file.buffer, {
        filename: file.fileName,
        contentType: file.contentType,
    });

    return fetch(url, {
        method: 'POST',
        //@ts-ignore
        body: data,
        headers: {
            //@ts-ignore
            "Content-Type": `multipart/form-data; boundary= ${data._boundary}`,
            pinata_api_key: API_KEY,
            pinata_secret_api_key: SECRET_API_KEY,
        },
    }).then(async (response: any) => {
        const uri = await response.json();

        return `ipfs://ipfs/${uri.IpfsHash}`;
    });
}

export const uploadJsonToIpfs = async (name: string, description: string, imgUrl: string, tokenId: string): Promise<string> => {
    const url = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

    const data = JSON.stringify({
        "name": name,
        "description": description,
        "image": imgUrl,
        "external_url": `https://app.rarible.com/${CONTRACT_ADDRESS}:${tokenId}`,
        "attributes":[{
            "key":"Test",
            "trait_type":"Test",
            "value":"Test",
        }]
    });

    return fetch(url, {
        method: 'POST',
        body: data,
        headers: {
            'Content-Type': 'application/json',
            pinata_api_key: API_KEY,
            pinata_secret_api_key: SECRET_API_KEY,
        },
    }).then(async (response: any) => {
        const uri = await response.json();

        return `ipfs://ipfs/${uri.IpfsHash}`;
    });
}
