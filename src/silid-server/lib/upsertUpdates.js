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
function upsertUpdates(updates, done) {
  if (!updates.length) {
    return done();
  }

  const update = updates.shift();
  models.Update.create(update).then(result => {
    upsertUpdates(updates, done);
  }).catch(err => {
    if (err.name === 'SequelizeUniqueConstraintError') {
      models.Update.upsert(update, { fields: ['name', 'updatedAt'] }).then(result => {
        upsertUpdates(updates, done);
      }).catch(err => {
        done(err);
      });
    }
    else {
      done(err);
    }
  });
};

module.exports = upsertUpdates;
