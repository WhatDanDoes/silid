'use strict';

/**
 * 2020-2-10
 *
 * `belongsToMany`
 *
 * Learned about migrating join tables here:
 * https://medium.com/@andrewoons/how-to-define-sequelize-associations-using-migrations-de4333bf75a7
 */

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('agent_organization', {
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
      OrganizationId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
      },
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('agent_organization');
  }
};
