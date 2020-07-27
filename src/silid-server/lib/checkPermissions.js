require('dotenv').config();
const models = require('../models');
const jwtAuthz = require('express-jwt-authz');

const apiScope = require('../config/apiPermissions');
const roles = require('../config/roles');
const getManagementClient = require('./getManagementClient');
const checkForUpdates = require('./checkForUpdates');

const assert = require('assert');

/**
 * The main function makes a call to the Auth0 API. This simply
 * DRYs out the code.
 */
function updateDbAndVerify(permissions, req, res, next) {
  const socialProfile = {...req.user};

  // Read agent's assigned roles
  let managementClient = getManagementClient([apiScope.read.users, apiScope.read.roles].join(' '));
  managementClient.getUserRoles({id: req.user.user_id}).then(roles => {
    req.user.roles = roles;

    models.Agent.findOne({ where: { email: socialProfile.email } }).then(agent => {
      req.agent = agent;

      // Is this a super agent?
      req.user.isSuper = !!req.user.roles.find(r => r.name === 'sudo');

      // Is this an organizer agent?
      req.user.isOrganizer = !!req.user.roles.find(r => r.name === 'organizer');

      // Fill in any blank agent columns with social profile data
      const updates = {};
      if (req.agent) {
        for (let key in socialProfile) {
          if (agent[key] === null) {
            updates[key] = socialProfile[key];
          }
        }
        if (req.agent.isSuper) {
          req.user.isSuper = true;
        }
      }

      let profileChanged = true;
      if (req.agent && req.agent.socialProfile) {
        try {
          assert.deepEqual(req.agent.socialProfile, socialProfile);
          profileChanged = false;

        } catch (error) {
          console.log('these aren\'t equal');
        }
      }

      if (!req.agent || profileChanged) {
        managementClient = getManagementClient(apiScope.read.users);
        managementClient.getUser({id: socialProfile.user_id}).then(results => {

          models.Agent.update(
            { socialProfile: results, ...updates },
            { returning: true, where: { email: socialProfile.email } }).then(function([rowsUpdate, [updatedAgent]]) {

            // Has this agent verified his email?
            if (!req.user.email_verified &&
                !(req.method === 'GET' && (req.baseUrl + req.path === '/agent/')) &&
                !(req.method === 'POST' && (req.baseUrl + req.path === '/agent/verify'))) {
              return res.status(401).json({message: 'Check your email to verify your account'});
            }

            if (updatedAgent) {
              req.agent = updatedAgent;

              if (req.agent.isSuper) {
                req.user.isSuper = true;
              }

              if (req.user.isSuper) {
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
              models.Agent.create({ name: socialProfile.name, email: socialProfile.email, socialProfile: socialProfile }).then(agent => {
                req.agent = agent;

                // Has this agent verified his email?
                if (!req.user.email_verified &&
                    !(req.method === 'GET' && (req.baseUrl + req.path === '/agent/')) &&
                    !(req.method === 'POST' && (req.baseUrl + req.path === '/agent/verify'))) {
                  return res.status(401).json({message: 'Check your email to verify your account'});
                }

                if (req.agent.isSuper) {
                  req.user.isSuper = true;
                }

                // This almost certainly superfluous. Revisit
                if (req.user.isSuper) {
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
            { returning: true, where: { email: socialProfile.email } }).then(function([rowsUpdate, [updatedAgent]]) {

            if (updatedAgent) {
              req.agent = updatedAgent;
            }

            if (req.agent.isSuper) {
              req.user.isSuper = true;
            }

            if (req.user.isSuper) {
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
          if (req.user.isSuper) {
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
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
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
      // Functionality covered by client-side tests
      checkForUpdates(req, err => {
        if (err) {
          return res.status(500).json(err);
        }
        updateDbAndVerify(permissions, req, res, next);
      });
    }
    else {
      // Not a viewer? Assign role
      let managementClient = getManagementClient([apiScope.read.roles].join(' '));
      managementClient.getRoles().then(auth0Roles => {

        // Find viewer role ID
        const roleId = auth0Roles.find(role => role.name === 'viewer').id;

        // 2020-6-23 It is assumed that if an agent is not a viewer, then no other role has been assigned
        managementClient = getManagementClient([apiScope.read.roles, apiScope.update.users].join(' '));
        managementClient.users.assignRoles({ id: req.user.user_id }, { roles: [roleId] }).then(results => {

          req.user.scope = [...new Set(req.user.scope.concat(roles.viewer))];

          checkForUpdates(req, err => {
            if (err) {
              return res.status(500).json(err);
            }
            updateDbAndVerify(permissions, req, res, next);
          });
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

