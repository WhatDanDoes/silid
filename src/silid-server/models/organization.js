'use strict';

module.exports = (sequelize, DataTypes) => {

  const Organization = sequelize.define('Organization', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Organization requires a name'
        },
        notEmpty: {
          msg: 'Organization requires a name'
        }
      },
      unique: {
        args: true,
        msg: 'That organization is already registered'
      }
    },
  }, {
    hooks: {
      afterCreate: function(org, options) {
        return org.addMember(org.creatorId);
      }
    }
  });

  Organization.associate = function(models) {
    Organization.belongsTo(models.Agent, {
      as: 'creator',
      foreignKey: {
        allowNull: false,
      },
      onDelete: 'CASCADE'
    });

    Organization.belongsToMany(models.Agent, {
      as: 'members',
      through: 'agent_organization',
    });

    Organization.belongsToMany(models.Team, {
      as: 'teams',
      through: 'organization_team'
    });
  };

  return Organization;
};
