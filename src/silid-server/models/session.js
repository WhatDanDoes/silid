/**
 * 2020-2-11
 *
 * Session table from: https://www.woolha.com/tutorials/node-js-express-persistent-session-store-with-postgresql-sequelize
 */
'use strict';
module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define('Session', {
    sid: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    expires: DataTypes.DATE,
    data: DataTypes.STRING(50000)
  }, {
    indexes: [
      {
        name: 'session_sid_index',
        method: 'BTREE',
        fields: ['sid'],
      },
    ],
  });

  return Session;
};
