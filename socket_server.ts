// import Server from "socket.io";
import * as S from './service';
const Server = require('socket.io');

const shutdown = (io: any) => {
    try {
        io.close();
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
    // @ts-ignore
    const io = new Server(process.env.PORT || 3000, { /* options */ });

    S.setup();

    io.on("connection", async (socket) => {
        try {
            console.log('server side connected');

            socket.on('mintAndSell', async (...args) => {
                const [deviceId, form] = args;
                const params = JSON.parse(form);
                await S.mintAndSell(
                    deviceId,
                    params.name,
                    params.description,
                    params.price,
                    params.royalty,
                    params.file,
                    socket,
                );
            });

            socket.on('connectWallet', async (...args) => {
                const [deviceId] = args;

                await S.connectWallet(deviceId, socket);
            });

            socket.on('disconnectWallet', async (...args) => {
                const [deviceId] = args;

                await S.disconnectWallet(deviceId, socket);
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

    // await redisClient.connect();
    await io.listen(3001);

    process.on('unhandledRejection', (err) => {
        console.log(`Uncaught error: ${err}`);
    }).on('SIGTERM', async () => {
        console.info('SIGTERM. Closing process...');
        shutdown(io);
    }).on('SIGINT', async () => {
        console.info('SIGINT. Closing process...');
        shutdown(io);
    });

    console.log(`Socket server is started`);
})()

