'use strict';
module.exports = (sequelize, DataTypes) => {
  const Invitation = sequelize.define('Invitation', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Invitation requires a name'
        },
        notEmpty: {
          msg: 'Invitation requires a name'
        },
      }
    },
    type: {
      type: DataTypes.ENUM('team', 'organization'),
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Invitation requires a type'
        },
        isIn: {
          args: [['team', 'organization']],
          msg: 'Invitation type can be one of either \'team\' or \'organization\''
        }
      },
    },
    uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Invitation requires a uuid'
        },
        isUUID: {
          args: 4,
          msg: 'Invitation requires a valid version 4 uuid'
        }
      },
    },
    recipient: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Invitation requires a recipient'
        },
        isEmail: {
          msg: 'Invitation requires a valid email for the recipient'
        }
      },
    }
  },
  {
    indexes: [
      {
        unique: true,
        fields: ['recipient', 'uuid'],
      }
    ]
  });

  return Invitation;
};
