export default () => ({
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    processorQueue: process.env.RABBITMQ_QUEUE || 'bridgepay-processor',
    coreQueue: process.env.RABBITMQ_QUEUE_CORE || 'bridgepay-core',
    gatewayQueue: process.env.RABBITMQ_QUEUE_GATEWAY || 'bridgepay-gateway',
    caPath: process.env.RABBITMQ_CA_PATH || '',
  },
});
