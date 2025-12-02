export default () => ({
  aws: {
    region: process.env.AWS_REGION || 'amqp://localhost:5672',
    accessKey: process.env.AWS_ACCESS_KEY || 'bridgepay-processor',
    secretKey: process.env.AWS_SECRET_KEY || 'bridgepay-core',
    s3Bucket: process.env.AWS_S3_BUCKET || 'bridgepay-gateway',
  },
});
