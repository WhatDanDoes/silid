module.exports = {
  development: {
    username: 'user',
    password: 'pass',
    database: 'silid_development',
    host: 'localhost',
    dialect: 'postgres'
  },
  test: {
    username: process.env.POSTGRES_USER || 'user',
    password: process.env.POSTGRES_PASSWORD || 'pass',
    database: process.env.POSTGRES_DB || 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    dialect: 'postgres'
  },
  e2e: {
    username: process.env.POSTGRES_USER || 'user',
    password: process.env.POSTGRES_PASSWORD || 'pass',
    database: process.env.POSTGRES_DB || 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    dialect: 'postgres',
    migrationStorage: 'none'
  },
  staging: {
    username: process.env.POSTGRES_USER || 'user',
    password: process.env.POSTGRES_PASSWORD || 'pass',
    database: process.env.POSTGRES_DB || 'silid_staging',
    host: process.env.POSTGRES_HOST || 'postgres',
    dialect: 'postgres'
  },
  development_aws: {
    username: process.env.DATABASE_USER_DEV,
    password: process.env.DATABASE_PASSWORD_DEV,
    database: 'postgres',
    host: process.env.DATABASE_HOST_DEV,
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
