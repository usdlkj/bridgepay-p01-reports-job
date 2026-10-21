// No access keys: credentials come from the default chain (IRSA in the cluster).
// No fallback defaults: a missing bucket or region must fail the job, not point it elsewhere.
export default () => ({
  aws: {
    region: process.env.AWS_REGION || '',
    s3Bucket: process.env.AWS_S3_BUCKET || '',
  },
});
