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
      // 2021-5-17
      //
      // This is weird... keep a close eye.
      //
      // Updating Sequelize caused an unexpected `SequelizeUniqueConstraintError`.
      // It seems the optional `fields` are being exluded instead of included, as
      // per the docs
      //
      // https://sequelize.org/master/class/lib/model.js~Model.html#static-method-upsert
      //
      // This is super weird and can be verified by looking at the generated SQL.
      // The original call is commented. The excluded fields call follows
      //
      //models.Update.upsert(update, { fields: ['data', 'updatedAt'] }).then(result => {
      models.Update.upsert(update, { fields: ['recipient', 'uuid', 'type'] }).then(result => {
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
