'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'Teams', // name of Source model
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
      'Teams', // name of Source model
      'creatorId' // key we want to remove
    );
  }
};
