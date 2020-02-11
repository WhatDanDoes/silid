/**
 * 2020-2-11
 *
 * Session table from: https://www.woolha.com/tutorials/node-js-express-persistent-session-store-with-postgresql-sequelize
 */
'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Session', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      sid: {
        type: Sequelize.STRING
      },
      expires: {
        type: Sequelize.DATE
      },
      data: {
        type: Sequelize.STRING(50000)
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Session');
  }
};
