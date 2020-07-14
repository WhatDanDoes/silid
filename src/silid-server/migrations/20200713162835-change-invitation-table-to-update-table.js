'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.renameTable('Invitations', 'Updates');
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.renameTable('Updates', 'Invitations');
  }
};
