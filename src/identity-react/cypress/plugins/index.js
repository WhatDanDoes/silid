require('dotenv').config();
const db = require('./database');

module.exports = (on, config) => {

  /**
   * 2019-11-25 https://stackoverflow.com/questions/52070262/cypress-pipe-console-log-and-command-log-to-output
   *
   * Log to stdout in headless tests
   */
  on('task', {
    log (message) {
      console.log(message);
      return null;
    },

    /**
     * Execute arbitrary queries against the API database
     */
    query(queryStr) {
      return db.sequelize.query(queryStr);
    },
  });

  config.env = {...config.env, ...process.env};

  return config;
}


