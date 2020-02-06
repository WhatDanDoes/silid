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

  const socialProfile = req.user._json;

  models.Agent.findOne({ where: { email: socialProfile.email } }).then(agent => {
    req.agent = agent;

    // Fill in any blank agent columns with social profile data
    const updates = {};
    if (req.agent) {
      for (let key in socialProfile) {
        if (agent[key] === null) {
          updates[key] = socialProfile[key];
        }
      }
    }

    if (!req.agent || JSON.stringify(req.agent.socialProfile) !== JSON.stringify(socialProfile)) {
      models.Agent.update(
        { socialProfile: socialProfile, ...updates },
        { returning: true, where: { email: socialProfile.email } }).then(function([rowsUpdate, [updatedAgent]]) {

        if (updatedAgent) {
          req.agent = updatedAgent;
          next();
        }
        else {
          models.Agent.create({ name: socialProfile.name, email: socialProfile.email, socialProfile: socialProfile }).then(agent => {
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
      if (Object.keys(updates).length) {
        models.Agent.update(
          { updates },
          { returning: true, where: { email: socialProfile.email } }).then(function([rowsUpdate, [updatedAgent]]) {

          if (updatedAgent) {
            req.agent = updatedAgent;
          }

          next();
        }).catch(err => {
          res.status(500).json(err);
        });
      }
      else {
        next();
      }
    }
  }).catch(err => {
    res.status(500).json(err);
  });
}

module.exports = sessionAuth;
