'use strict';
module.exports = (sequelize, DataTypes) => {
  const Agent = sequelize.define('Agent', {
    name: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Agent requires an email'
        },
        isEmail: {
          msg: 'Agent requires a valid email'
        }
      },
      unique: {
        args: true,
        msg: 'That agent is already registered'
      }
    },
    socialProfile: {
      strict: true,
      type: DataTypes.JSONB
    }
  }, {});

  Agent.associate = function(models) {
    Agent.belongsToMany(models.Organization, {
      through: 'agent_organization'
    });

    Agent.belongsToMany(models.Team, {
      as: 'teams',
      through: 'agent_team'
    });
  };

  return Agent;
};
