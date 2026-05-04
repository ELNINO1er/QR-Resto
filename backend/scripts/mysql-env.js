export function getMysqlConfig({ withDatabase = true } = {}) {
  const config = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    multipleStatements: true,
    charset: 'utf8mb4',
  };

  if (withDatabase) config.database = process.env.MYSQL_DATABASE || 'qr_resto';
  return config;
}

export function getMysqlDatabase() {
  return process.env.MYSQL_DATABASE || 'qr_resto';
}
