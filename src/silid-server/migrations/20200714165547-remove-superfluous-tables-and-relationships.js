'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.dropTable('OrganizationMembers'),
        queryInterface.dropTable('organization_team'),
        queryInterface.dropTable('TeamMembers'),
        queryInterface.dropTable('Teams'),
        queryInterface.dropTable('Organizations'),
      ]);
    });
  },

  down: (queryInterface, Sequelize) => {
  }
};
