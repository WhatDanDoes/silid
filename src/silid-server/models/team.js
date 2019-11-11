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
  }, {});

  Team.associate = function(models) {
    Team.belongsTo(models.Organization, {
      as: 'organization',
      foreignKey: {
        allowNull: false,
      },
      onDelete: 'CASCADE'
    });

    Team.belongsToMany(models.Agent, {
      through: 'agent_team'
    });

    Team.belongsToMany(models.Organization, {
      through: 'organization_team'
    });
  };

  return Team;
};
