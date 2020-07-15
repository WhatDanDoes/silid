'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.createTable('Agents', {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
          },
          name: {
            type: Sequelize.STRING
          },
          email: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
          },
          socialProfile: {
            type: Sequelize.JSONB
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE
          }
        }),
        queryInterface.createTable('Session', {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
          },
          sid: {
            type: Sequelize.STRING
          },
          expires: {
            type: Sequelize.DATE
          },
          data: {
            type: Sequelize.STRING(50000)
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE
          }
        }),
        queryInterface.createTable('Updates', {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
          },
          type: {
            type: Sequelize.ENUM('team', 'organization'),
            allowNull: false,
          },
          uuid: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4, 
            allowNull: false,
          },
          recipient: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          data: {
            type: Sequelize.DataTypes.JSON,
            allowNull: false,
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE
          }
        }, {
          // 2020-5-6 https://github.com/sequelize/cli/issues/410#issuecomment-523420333
          uniqueKeys: {
            recipient_uuid: {
              customIndex: true,
              fields: ['recipient', 'uuid']
            }
          }
        })
      ]);
    });
  },

  down: (queryInterface, Sequelize) => {
  }
};
