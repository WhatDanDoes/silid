'use strict';

const Sequelize = require('sequelize');
const db = {};

/**
 * This matches the `e2e` config in `src/silid-server/config/
 */
const config = {
  "username": "user",
  "password": "pass",
  "database": "postgres",
  "host": "localhost",
  "dialect": "postgres"
};

const sequelize = new Sequelize(config.database, config.username, config.password, config);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
