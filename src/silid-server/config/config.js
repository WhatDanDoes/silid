module.exports = {
  development: {
    username: 'user',
    password: 'pass',
    database: 'silid_development',
    host: 'postgres',
    dialect: 'postgres'
  },
  test: {
    username: 'postgres',
    database: 'postgres',
    host: 'localhost',
    dialect: 'postgres'
  },
  e2e: {
    username: 'user',
    password: 'pass',
    database: 'postgres',
    host: 'localhost',
    dialect: 'postgres',
    migrationStorage: 'none'
  },
  staging: {
    username: 'user',
    password: 'pass',
    database: 'silid_staging',
    host: 'postgres',
    dialect: 'postgres'
  },
  production: {
    username: process.env.DATABASE_USER_PROD,
    password: process.env.DATABASE_PASSWORD_PROD,
    database: 'postgres',
    host: process.env.DATABASE_HOST_PROD,
    dialect: 'postgres'
  }
};
