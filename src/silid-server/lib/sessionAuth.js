require('dotenv').config();
const models = require('../models');

/**
 * This is called subsequent to the `passport.authenticate` function.
 * `passport` attaches a `user` property to `req`
 */
const sessionAuth = function(req, res, next) {

  if (!req.user) {
    return res.redirect('/login')
  }

  models.Agent.findOne({ where: { email: req.user.email } }).then(agent => {
    req.agent = agent;

    if (!req.agent || JSON.stringify(req.agent.socialProfile) !== JSON.stringify(req.user)) {
      models.Agent.update(
        { socialProfile: req.user },
        { returning: true, where: { email: req.user.email } }).then(function([rowsUpdate, [updatedAgent]]) {

        if (updatedAgent) {
          req.agent = updatedAgent;
          next();
        }
        else {
          models.Agent.create({ name: req.user.name, email: req.user.email, socialProfile: req.user }).then(agent => {
            req.agent = agent;
            next();
          }).catch(err => {
            res.status(500).json(err);
          });
        }
      }).catch(err => {
        res.status(500).json(err);
      });
    }
    else {
      next();
    }
  }).catch(err => {
    res.status(500).json(err);
  });
}

module.exports = sessionAuth;
