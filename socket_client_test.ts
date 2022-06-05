import { io } from "socket.io-client";
import  * as fs from "fs";

const baseUrl = 'ws://localhost:3001';

const socket = io(baseUrl);

socket.on('connect', function () {
    console.log('socket client CONNECTED');

    // const buffer = fs.readFileSync('./test_image.jpeg');

    socket.emit('connectWallet', 'deviceId')
});

// _deviceId

socket.on('statuses_deviceId', (...args) => {
    console.log(args[0])
});

process.on('unhandledRejection', (err) => {
    console.log(`Uncaught error: ${err}`);
}).on('SIGTERM', async () => {
    console.info('SIGTERM. Closing process...');
    socket.close()
}).on('SIGINT', async () => {
    console.info('SIGINT. Closing process...');
    socket.close()
});