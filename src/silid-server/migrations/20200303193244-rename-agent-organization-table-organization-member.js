'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.renameTable('agent_organization', 'OrganizationMembers')
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.renameTable('OrganizationMembers', 'agent_organization')
  }
};
