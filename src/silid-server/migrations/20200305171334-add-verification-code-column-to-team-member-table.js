'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'TeamMembers',
      'verificationCode',
      {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4, 
        allowNull: true,
      }
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('TeamMembers', 'verificationCode');
  }
};
