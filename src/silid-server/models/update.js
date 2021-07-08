'use strict';
module.exports = (sequelize, DataTypes) => {
  const Update = sequelize.define('Update', {
    type: {
      type: DataTypes.ENUM('team', 'organization'),
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Update requires a type'
        },
        isIn: {
          args: [['team', 'organization']],
          msg: 'Update type can be one of either \'team\' or \'organization\''
        }
      },
    },
    uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Update requires a uuid'
        },
        isUUID: {
          args: 4,
          msg: 'Update requires a valid version 4 uuid'
        }
      },
    },
    recipient: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Update requires a recipient'
        },
        isEmail: {
          msg: 'Update requires a valid email for the recipient'
        }
      },
    },
    data: {
      type: DataTypes.JSON,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Update requires data'
        },
        isJSON(val) {
          if (typeof val !== 'object') {
            throw new Error('Update data supplied is not valid JSON');
          }
          else if (Object.keys(val).length < 1){
            throw new Error('Update contains no data');
          }
          try {
            console.log(typeof val);
            JSON.parse(JSON.stringify(val));
          }
          catch (err) {
            throw new Error('Update data supplied is not valid JSON');
          }
        },
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

  Update.addHook('beforeValidate', (update, options) => {
    if (update.recipient) {
      update.recipient = update.recipient.toLowerCase();
    }
  });

  return Update;
};
