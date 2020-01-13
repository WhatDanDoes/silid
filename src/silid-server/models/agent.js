'use strict';

module.exports = (sequelize, DataTypes) => {

  const Agent = sequelize.define('Agent', {
    name: {
      type: DataTypes.STRING,
    },
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
    },
    accessToken: {
      type: DataTypes.TEXT
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

  /**
   * Check new token against last token provided by this agent.
   *
   * This method does not validate the JWT.
   */
  Agent.prototype.isFresh = function(accessToken, done) {
    if (this.accessToken === accessToken) {
      return done(null, true);
    }
    this.accessToken = accessToken;
    this.save().then(() => {
      done(null, false);
    }).catch(err => {
      done(err);
    });
  };

  return Agent;
};
