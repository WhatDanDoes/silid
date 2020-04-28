require('dotenv').config();
const models = require('../models');
const jwtAuthz = require('express-jwt-authz');

const apiScope = require('../config/apiPermissions');
const roles = require('../config/roles');
const getManagementClient = require('../lib/getManagementClient');

const assert = require('assert');

/**
 * The main function makes a call to the Auth0 API. This simply
 * DRYs out the code.
 */
function updateDbAndVerify(permissions, req, res, next) {
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

    let profileChanged = true;
    if (req.agent && req.agent.socialProfile) {
      try {
        assert.deepEqual(req.agent.socialProfile._json, socialProfile._json);
        profileChanged = false;

      } catch (error) {
        console.log('these aren\'t equal');
      }
    }

    if (!req.agent || profileChanged) {

      const managementClient = getManagementClient(apiScope.read.users);
      managementClient.getUser({id: socialProfile.user_id}).then(results => {

        models.Agent.update(
          { socialProfile: results, ...updates },
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
      }).catch(err => {
        res.status(500).json(err);
      });
    }
    else {
      if (Object.keys(updates).length) {
        models.Agent.update(
          updates,
          { returning: true, where: { email: socialProfile._json.email } }).then(function([rowsUpdate, [updatedAgent]]) {

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

/**
 * This is called subsequent to the `passport.authenticate` function.
 * `passport` attaches a `user` property to `req`
 */
const checkPermissions = function(permissions) {
  return (req, res, next) => {

    if (!req.user) {
      return res.redirect('/login')
    }

    // Make sure agent has basic viewing permissions
    let isViewer = true;
    if (!req.user.scope) {
      req.user.scope = [];
    }
    for (let p of roles.viewer) {
      if (req.user.scope.indexOf(p) < 0) {
        isViewer = false;
        break;
      }
    }

    if (isViewer) {
      updateDbAndVerify(permissions, req, res, next);
    }
    else {
      // Not a viewer? Assign role
      let managementClient = getManagementClient([apiScope.read.roles].join(' '));
      managementClient.getRoles().then(auth0Roles => {

        // Find viewer role ID
        const roleId = auth0Roles.find(role => role.name === 'viewer').id;

        managementClient = getManagementClient([apiScope.read.roles, apiScope.update.users].join(' '));
        managementClient.users.assignRoles({ id: req.user.id }, { roles: [roleId] }).then(results => {
          req.user.scope = [...new Set(req.user.scope.concat(roles.viewer))];
          updateDbAndVerify(permissions, req, res, next);
        }).catch(err => {
          res.status(err.statusCode).json(err.message.error_description);
        });
      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });
    }
  };
};

module.exports = checkPermissions;

