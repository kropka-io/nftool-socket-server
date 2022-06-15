import { Server } from "socket.io";
import { createClient } from 'redis';
import * as S from './service';

const shutdown = (io: any, redisClient: any) => {
    try {
        io.close();
        redisClient.quit();
        console.log('Closed redis');
        console.log('Closed postgres connections');
    } catch (err) {
        console.log(`Error closing server: ${err}`);
    } finally {
        console.log('Closed process');
        process.exit(0);
    }
}

(async () => {
    const redisClient = createClient({ url: process.env.REDIS_URI });

    redisClient.on('error', (err) => console.log('Redis Client Error', err));

    const io = new Server(3000, { /* options */ });

    S.setup();

    io.on("connection", async (socket) => {
        try {
            console.log('server side connected');

            socket.on('mintAndSell', async (...args) => {
                const [deviceId, form] = args;

                await S.mintAndSell(
                    deviceId,
                    form.name,
                    form.description,
                    form.price,
                    form.royalty,
                    form.file,
                    redisClient,
                    socket.emit,
                );
            });

            socket.on('connectWallet', async (...args) => {
                const [deviceId] = args;

                await S.connectWallet(deviceId, redisClient, socket);
            });

            socket.on('disconnectWallet', async (...args) => {
                const [deviceId] = args;

                await S.disconnectWallet(deviceId, redisClient, socket);
            });
        } catch(e) {
            console.log('a');
        }
    });

    io.on("connect_error", (err) => {
        console.log(err.req);      // the request object
        console.log(err.code);     // the error code, for example 1
        console.log(err.message);  // the error message, for example "Session ID unknown"
        console.log(err.context);  // some additional error context
    });

    io.on("disconnect", (err) => {
        console.log('server side disconnect')
    });

    await redisClient.connect();
    await io.listen(3001);

    process.on('unhandledRejection', (err) => {
        console.log(`Uncaught error: ${err}`);
    }).on('SIGTERM', async () => {
        console.info('SIGTERM. Closing process...');
        shutdown(io, redisClient);
    }).on('SIGINT', async () => {
        console.info('SIGINT. Closing process...');
        shutdown(io, redisClient);
    });

    console.log(`Socket server is started`);
})()