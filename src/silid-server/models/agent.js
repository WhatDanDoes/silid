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
    },
    isSuper: {
      type: DataTypes.VIRTUAL,
      get: function() {
        return process.env.ROOT_AGENT === this.email;
      }
    }
  }, {});

  Agent.addHook('beforeValidate', (agent, options) => {
    if (agent.email) {
      agent.email = agent.email.toLowerCase();
    }
  });

  return Agent;
};
