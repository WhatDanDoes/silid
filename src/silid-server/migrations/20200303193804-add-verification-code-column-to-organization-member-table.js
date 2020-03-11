'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'OrganizationMembers',
      'verificationCode',
      {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4, 
        allowNull: true,
      }
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('OrganizationMembers', 'verificationCode');
  }
};
