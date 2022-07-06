const sleep = (ms, cb) => new Promise<string>((resolve, reject) => {
    setTimeout(() => {
        cb();
        resolve('sleep finished');
    }, ms);
})

export default async function race(func, promise) {
    const firstPromise = await Promise.race([sleep(1000, func), promise]);
    if (firstPromise === 'sleep finished') {
        return race(func, promise);
    }
}
