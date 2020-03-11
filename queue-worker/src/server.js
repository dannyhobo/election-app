const amqp = require('amqplib/callback_api');
const db = require('./models');

// config
const RABBIT_QUEUE_NAME = 'votes';
const RABBIT_URL = 'amqp://rabbitmq';

// connect to RabbitMQ
amqp.connect(RABBIT_URL, (error, connection) => {
    connection.createChannel((err, channel) => {
        channel.assertQueue(RABBIT_QUEUE_NAME, {
            durable: true,
        });

        channel.prefetch(10);
        console.log(`Waiting for vote messages in ${RABBIT_QUEUE_NAME} `);

        channel.consume(RABBIT_QUEUE_NAME, async (msg) => {
            // we received a message with votes, parse it and add it to an array
            const data = JSON.parse(msg.content.toString());
            const votes = data.map(vote => JSON.parse(vote));

            try {
                // insert all the votes in bulk
                const result = await db.Vote.bulkCreate(votes);

                if (result) {
                    channel.ack(msg);
                }
            } catch (e) {
                console.log('RabbitMQ error', e);
            }
        }, {
            noAck: false,
        });
    });
});
