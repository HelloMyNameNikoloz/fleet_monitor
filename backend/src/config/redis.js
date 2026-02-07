const { createClient } = require('redis');

let client = null;
let subscriber = null;

function buildRedisOptions() {
    const url = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
    if (!url) {
        return null;
    }

    const isTls = url.startsWith('rediss://');
    return {
        url,
        socket: isTls ? { tls: true, rejectUnauthorized: false } : undefined
    };
}

async function getClient() {
    if (!client) {
        const options = buildRedisOptions();
        client = createClient(options || {});

        client.on('error', (err) => console.error('Redis Client Error:', err));
        client.on('connect', () => console.log('Connected to Redis'));

        await client.connect();
    }
    return client;
}

async function getSubscriber() {
    if (!subscriber) {
        const options = buildRedisOptions();
        subscriber = createClient(options || {});

        subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));

        await subscriber.connect();
    }
    return subscriber;
}

// Cache helpers
async function cacheGet(key) {
    const redis = await getClient();
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
}

async function cacheSet(key, value, ttlSeconds = 10) {
    const redis = await getClient();
    await redis.setEx(key, ttlSeconds, JSON.stringify(value));
}

async function cacheDelete(key) {
    const redis = await getClient();
    await redis.del(key);
}

// Pub/Sub helpers
async function publish(channel, message) {
    const redis = await getClient();
    await redis.publish(channel, JSON.stringify(message));
}

async function subscribe(channel, callback) {
    const sub = await getSubscriber();
    await sub.subscribe(channel, (message) => {
        callback(JSON.parse(message));
    });
}

module.exports = {
    getClient,
    getSubscriber,
    cacheGet,
    cacheSet,
    cacheDelete,
    publish,
    subscribe
};
