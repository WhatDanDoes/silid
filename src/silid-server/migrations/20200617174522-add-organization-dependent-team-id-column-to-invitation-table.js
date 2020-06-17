'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Invitations', 'teamId', {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4, 
      allowNull: false,
    })
  },
  down: (queryInterface, Sequelize) => {
    queryInterface.removeColumn('Invitations', 'teamId', { transaction: t });
  }
};
