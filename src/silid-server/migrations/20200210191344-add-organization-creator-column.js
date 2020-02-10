'use strict';

/**
 * 2020-2-10
 *
 * `belongsTo`
 *
 * Learned about migrating join tables here:
 * https://medium.com/@andrewoons/how-to-define-sequelize-associations-using-migrations-de4333bf75a7
 */

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'Organizations', // name of Source model
      'creatorId', // name of the key we're adding 
      {
        type: Sequelize.INTEGER,
        references: {
          model: 'Agents', // name of Target model
          key: 'id', // key in Target model that we're referencing
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      }
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'Organizations', // name of Source model
      'creatorId' // key we want to remove
    );
  }
};
