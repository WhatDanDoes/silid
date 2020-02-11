'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('organization_team', {
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      TeamId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
      },
      OrganizationId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
      },
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('organization_team');
  }
};
