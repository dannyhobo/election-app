const amqp = require('amqplib/callback_api');
const redis = require('redis');
const db = require('../models');

// queue variables
const RABBIT_URL = 'amqp://rabbitmq';
const RABBIT_QUEUE_NAME = 'votes';

let votes = [];
let isExpired = false;
let lastInsert = new Date();

// redis client
const client = redis.createClient(6379, 'redis');

// connect to redis client
client.on('connect', () => {
    console.log('Redis client connected');
});

// show error if we can't connect to redis client
client.on('error', () => {
    console.log('Something went wrong when connecting to redis');
});

// connect to RabbitMQ
amqp.connect(RABBIT_URL, (error, conn) => {
    if (error) {
        throw new Error(error);
    }

    conn.createChannel((err, chan) => {
        if (err) {
            throw new Error(err);
        }

        chan.assertQueue(RABBIT_QUEUE_NAME, {durable: true});

        channel = chan;
    });
});

// send all items to rabbitMQ
const sendItems = () => {
    if (votes.length > 99 || (votes.length > 0 && isExpired)) {
        const data = JSON.stringify(votes);

        channel.sendToQueue(RABBIT_QUEUE_NAME, Buffer.from(data), {
            persistent: true,
        });

        // reset queue variables
        votes = [];
        isExpired = false;
        lastInsert = new Date();
    }
};

// triggers sendItems every 10 seconds
setInterval(() => {
    isExpired = new Date() - 10000 >= lastInsert;
    sendItems();
}, 1000);

// get cached value from redis
const getCachedValue = async cacheKey => new Promise((resolve, reject) => {
    client.get(cacheKey, (err, reply) => {
        if (err) {
            reject(new Error('redis error'));
        }

        if (reply) {
            resolve(reply);
        }

        resolve(false);
    });
});

// write a value to redis, and let it expire after 30 seconds
const writeValueToCache = (key, value) => {
    client.set(key, parseInt(value, 10));
    client.expire(key, 30);
};

// increments the vote count in redis, and let it expire after 30 seconds
const incrementVoteCache = async (cacheKey) => {
    // check if redis already has this key
    const value = await getCachedValue(cacheKey);
    if (!value) {
        // no key exists yet, update redis with current values from SQL
        await getResults();
    }

    // now cachekey exists for sure, increment it
    client.incr(cacheKey);
    client.expire(cacheKey, 30);
};

// returns all results from either redis or database, grouped by party & count
const getResults = async () => {
    // check if redis has values for both parties
    let democraticCount = await getCachedValue('DEMOCRATIC');
    let republicanCount = await getCachedValue('REPUBLICAN');

    if (!democraticCount || !republicanCount) {
        // at least one of the values doesn't exist yet in redis, create them both
        democraticCount = 0;
        republicanCount = 0;

        const dbResults = await db.Vote.findAll({
            group: ['party'],
            attributes: ['party', [db.Sequelize.fn('COUNT', 'party'), 'total']],
        });

        dbResults.forEach(result => {
            const {party, total} = result.dataValues;
            if (party === 'DEMOCRATIC') {
                democraticCount = total;
            } else {
                republicanCount = total;
            }
        });

        // save values to redis
        await writeValueToCache('DEMOCRATIC', democraticCount);
        await writeValueToCache('REPUBLICAN', republicanCount);
    }

    return {
        'DEMOCRATIC': democraticCount,
        'REPUBLICAN': republicanCount,
    }
};

// inserts a vote into the database
const createVote = async (req, res) => {
    let {party} = req.body;

    if (!party) {
        throw new Error('No party given');
    }

    // make sure we always have a valid party
    party = party.toUpperCase();
    if (party !== 'DEMOCRATIC') {
        party = 'REPUBLICAN';
    }

    // add vote to the array with current date
    votes.push(JSON.stringify({party, createdAt: new Date()}));

    // increment value in redis
    await incrementVoteCache(party);

    const results = await getResults();
    return res.status(201).send(results);
};

module.exports = {
    createVote
};
