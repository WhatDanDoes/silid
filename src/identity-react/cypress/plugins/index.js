require('dotenv').config();
const cypressTypeScriptPreprocessor = require('./cy-ts-preprocessor')
const db = require('./database');

module.exports = (on, config) => {
  on('file:preprocessor', cypressTypeScriptPreprocessor);

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


  /**
   * 2020-4-3
   *
   * I want to refer to these old tests without executing them
   */
  config.ignoreTestFiles = "**/archive/**/*Spec.js";

  config.env = {...config.env, ...process.env};

  return config;
}


