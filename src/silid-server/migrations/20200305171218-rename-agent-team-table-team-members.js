'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.renameTable('agent_team', 'TeamMembers')
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.renameTable('TeamMembers', 'agent_team')
  }
};
