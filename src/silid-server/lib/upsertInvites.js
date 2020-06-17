const models = require('../models');

/**
 * 2020-5-20 https://github.com/sequelize/sequelize/pull/11984#issuecomment-625193209
 *
 * To be used until Sequelize's `bulkCreate` method can handle composite indexes
 *
 * Used in conjunction with PUT /team/:id defined below
 *
 * @params array
 * @params function
 */
function upsertInvites(invites, done) {
  if (!invites.length) {
    return done();
  }

  const invite = invites.shift();
  models.Invitation.create(invite).then(result => {
    upsertInvites(invites, done);
  }).catch(err => {
    if (err.name === 'SequelizeUniqueConstraintError') {
      models.Invitation.upsert(invite, { fields: ['name', 'updatedAt'] }).then(result => {
        upsertInvites(invites, done);
      }).catch(err => {
        done(err);
      });
    }
    else {
      done(err);
    }
  });
};

module.exports = upsertInvites;
