/**
 * 2020-2-11
 *
 * Session table from: https://www.woolha.com/tutorials/node-js-express-persistent-session-store-with-postgresql-sequelize
 */
'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Sessions', {
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
        type: Sequelize.STRING
      },
//      createdAt: {
//        allowNull: false,
//        type: Sequelize.DATE
//      },
//      updatedAt: {
//        allowNull: false,
//        type: Sequelize.DATE
//      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Sessions');
  }
};
