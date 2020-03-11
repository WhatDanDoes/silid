'use strict';

module.exports = (sequelize, DataTypes) => {

  const TeamMember = require('./teamMember')(sequelize, DataTypes);

  const Team = sequelize.define('Team', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Team requires a name'
        },
        notEmpty: {
          msg: 'Team requires a name'
        }
      },
      unique: {
        args: true,
        msg: 'That team is already registered'
      }
    },
  }, {
    hooks: {
      afterCreate: function(team, options) {
        return new Promise((resolve, reject) => {
          team.addOrganization(team.organizationId).then(org => {
            resolve(new TeamMember({ AgentId: team.creatorId, TeamId: team.id, verificationCode: null }).save());
          }).catch(err => {
            reject(err);
          });
        });
      }
    }
  });

  Team.associate = function(models) {
    Team.belongsTo(models.Agent, {
      as: 'creator',
      foreignKey: {
        allowNull: false,
      },
      onDelete: 'CASCADE'
    });

    Team.belongsTo(models.Organization, {
      as: 'organization',
      foreignKey: {
        allowNull: false,
      },
      onDelete: 'CASCADE'
    });

    Team.belongsToMany(models.Agent, {
      as: 'members',
      through: 'TeamMember'
    });

    Team.belongsToMany(models.Organization, {
      through: 'organization_team'
    });
  };

  return Team;
};

