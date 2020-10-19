'use strict';
module.exports = (sequelize, DataTypes) => {
  const ClientApp = sequelize.define('ClientApp', {
    profile: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    clientId: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Client application requires an Auth0 client_id'
        },
        notEmpty: {
          msg: 'Client application requires an Auth0 client_id'
        }
      },
      unique: {
        args: true,
        msg: 'That client application is already registered'
      }
    },
  }, {});

  ClientApp.addHook('beforeValidate', (app, options) => {
    if (app.clientId) {
      app.clientId = app.clientId.trim();
    }
  });

  return ClientApp;
};
