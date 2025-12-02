export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  ftpHost: process.env.FTP_HOST || 'localhost',
  ftpPort: process.env.FTP_PORT || '22',
  ftpUsername: process.env.FTP_USERNAME || 'user',
  ftpPassword: process.env.FTP_PASSWORD || 'password',
  ftpPath: process.env.FTP_PATH || '/reports',
  sendFtp: process.env.SEND_FTP || 'no',
  reportPath: process.env.REPORT_PATH || './reports',
  ppnValue: process.env.PPN_VALUE || '11',
});
