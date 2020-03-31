require('dotenv').config();
const models = require('../models');
const jwtAuthz = require('express-jwt-authz');

/**
 * This is called subsequent to the `passport.authenticate` function.
 * `passport` attaches a `user` property to `req`
 */
const checkPermissions = function(permissions) {
  return (req, res, next) => {

    if (!req.user) {
      return res.redirect('/login')
    }

    const socialProfile = req.user;

    models.Agent.findOne({ where: { email: socialProfile._json.email } }).then(agent => {
      req.agent = agent;

      // Fill in any blank agent columns with social profile data
      const updates = {};
      if (req.agent) {
        for (let key in socialProfile._json) {
          if (agent[key] === null) {
            updates[key] = socialProfile._json[key];
          }
        }
      }

      if (!req.agent || JSON.stringify(req.agent.socialProfile) !== JSON.stringify(socialProfile)) {
        models.Agent.update(
          { socialProfile: socialProfile, ...updates },
          { returning: true, where: { email: socialProfile._json.email } }).then(function([rowsUpdate, [updatedAgent]]) {

          if (updatedAgent) {
            req.agent = updatedAgent;

            if (req.agent.isSuper) {
              return next();
            }

            jwtAuthz(permissions, { failWithError: true, checkAllScopes: true })(req, res, err => {
              if (err) {
                return res.status(err.statusCode).json(err);
              }

              next();
            });
          }
          else {
            models.Agent.create({ name: socialProfile._json.name, email: socialProfile._json.email, socialProfile: socialProfile }).then(agent => {
              req.agent = agent;

              if (req.agent.isSuper) {
                return next();
              }

              jwtAuthz(permissions, { failWithError: true, checkAllScopes: true })(req, res, err => {
                if (err) {
                  return res.status(err.statusCode).json(err);
                }

                next();
              });
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

            if (req.agent.isSuper) {
              return next();
            }

            jwtAuthz(permissions, { failWithError: true, checkAllScopes: true })(req, res, err => {
              if (err) {
                return res.status(err.statusCode).json(err);
              }
              next();
            });
          }).catch(err => {
            res.status(500).json(err);
          });
        }
        else {
          if (req.agent.isSuper) {
            return next();
          }

          jwtAuthz(permissions, { failWithError: true, checkAllScopes: true })(req, res, err => {
            if (err) {
              return res.status(err.statusCode).json(err);
            }

            next();
          });
        }
      }
    }).catch(err => {
      res.status(500).json(err);
    });
  };
}

module.exports = checkPermissions;
