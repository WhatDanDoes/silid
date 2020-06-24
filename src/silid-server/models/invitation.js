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
    teamId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: {
          args: 4,
          msg: 'Organization invitation requires a valid version 4 team uuid'
        },
        isOrganization(value) {
          if (value && this.type !== 'organization') {
            throw new Error('Team uuid only applies to organization invitations');
          }
          else if (this.type === 'organization' && !value) {
            throw new Error('Organization invitation requires a team uuid');
          }
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

  Invitation.addHook('beforeValidate', (invite, options) => {
    if (invite.recipient) {
      invite.recipient = invite.recipient.toLowerCase();
    }
  });

  return Invitation;
};
