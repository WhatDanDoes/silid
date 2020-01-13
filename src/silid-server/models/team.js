'use strict';

module.exports = (sequelize, DataTypes) => {

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
        team.addMember(team.creatorId);
        return team.addOrganization(team.organizationId);
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
      through: 'agent_team'
    });

    Team.belongsToMany(models.Organization, {
      through: 'organization_team'
    });
  };

  return Team;
};
