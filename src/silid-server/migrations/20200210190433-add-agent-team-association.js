'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('agent_team', {
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      AgentId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
      },
      TeamId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
      },
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('agent_team');
  }
};
