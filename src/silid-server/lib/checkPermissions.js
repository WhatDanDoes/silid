require('dotenv').config();
const models = require('../models');
const jwtAuthz = require('express-jwt-authz');

const apiScope = require('../config/apiPermissions');
const roles = require('../config/roles');
const getManagementClient = require('./getManagementClient');
const checkForUpdates = require('./checkForUpdates');

const assert = require('assert');

const fetch = require('node-fetch');

/**
 * The main function makes a call to the Auth0 API. This simply
 * DRYs out the code.
 */
function updateDbAndVerify(permissions, req, res, next) {
  const socialProfile = {...req.user};

  // Read agent's assigned roles
  const managementClient = getManagementClient([apiScope.read.users, apiScope.read.roles].join(' '));
  managementClient.getUserRoles({id: req.user.user_id}).then(roles => {
    req.user.roles = roles;

    models.Agent.findOne({ where: { email: socialProfile.email } }).then(agent => {

      // Is this a super agent?
      req.user.isSuper = !!req.user.roles.find(r => r.name === 'sudo');

      // Is this an organizer agent?
      req.user.isOrganizer = !!req.user.roles.find(r => r.name === 'organizer');

      // Fill in any blank agent columns with social profile data
      const updates = {};
      if (agent) {
        for (let key in socialProfile) {
          if (agent[key] === null) {
            updates[key] = socialProfile[key];
          }
        }
        if (agent.isSuper) {
          req.user.isSuper = true;
        }
      }

      let profileChanged = true;
      if (agent && agent.socialProfile) {
        try {
          assert.deepEqual(agent.socialProfile, socialProfile);
          profileChanged = false;

        } catch (error) {
          console.log('these aren\'t equal');
        }
      }

      if (!agent || profileChanged) {
        managementClient.getUser({id: socialProfile.user_id}).then(results => {

          models.Agent.update(
            { socialProfile: results, ...updates },
            { returning: true, where: { email: socialProfile.email } }).then(function([rowsUpdate, [updatedAgent]]) {

            // Has this agent verified his email?
            if (!req.user.email_verified &&
                !(req.method === 'GET' && (req.baseUrl + req.path === '/agent/')) &&
                !(req.method === 'POST' && (req.baseUrl + req.path === '/agent/verify')) &&
                !((req.method === 'GET' || req.method === 'PUT') && (req.baseUrl === '/locale'))) {
              return res.status(401).json({message: 'Check your email to verify your account'});
            }

            if (updatedAgent) {
              agent = updatedAgent;

              if (agent.isSuper) {
                req.user.isSuper = true;
              }

              if (req.user.isSuper) {
                return next();
              }

              jwtAuthz(permissions, { failWithError: true, checkAllScopes: true })(req, res, err => {
                if (err) {
                  return next(err);
                }

                next();
              });
            }
            else {
              models.Agent.create({ name: socialProfile.name, email: socialProfile.email, socialProfile: socialProfile }).then(agent => {

                // Has this agent verified his email?
                if (!req.user.email_verified &&
                    !(req.method === 'GET' && (req.baseUrl + req.path === '/agent/')) &&
                    !(req.method === 'POST' && (req.baseUrl + req.path === '/agent/verify'))) {
                  return res.status(401).json({message: 'Check your email to verify your account'});
                }

                if (agent.isSuper) {
                  req.user.isSuper = true;
                }

                // This almost certainly superfluous. Revisit
                if (req.user.isSuper) {
                  return next();
                }

                jwtAuthz(permissions, { failWithError: true, checkAllScopes: true })(req, res, err => {
                  if (err) {
                    return next(err);
                  }

                  next();
                });
              }).catch(err => {
                return next(err);
              });
            }
          }).catch(err => {
            return next(err);
          });
        }).catch(err => {
          return next(err);
        });
      }
      else {
        if (Object.keys(updates).length) {
          models.Agent.update(
            updates,
            { returning: true, where: { email: socialProfile.email } }).then(function([rowsUpdate, [updatedAgent]]) {

            if (updatedAgent) {
              agent = updatedAgent;
            }

            if (agent.isSuper) {
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
            return next(err);
          });
        }
        else {
          if (req.user.isSuper) {
            return next();
          }

          jwtAuthz(permissions, { failWithError: true, checkAllScopes: true })(req, res, err => {
            if (err) {
              return next(err);
            }

            next();
          });
        }
      }
    }).catch(err => {
      next(err);
    });
  }).catch(err => {
    next(err);
  });
};

/**
 * Make sure there's a `user` attached to the `req` object. If not, check for
 * Authorization header and hit Auth0 `/userinfo` endpoint to validate.
 */
const checkAgent = function(req, res, done) {
  if (!req.user) {
    const authorization = req.header('authorization');
    if (authorization) {
      const authParts = authorization.split(' ');
      if (authParts[0].toLowerCase() == 'bearer') {
        fetch(`https://${process.env.AUTH0_M2M_DOMAIN}/userinfo`, {
          method: 'get',
          headers: {
            'Authorization': req.header('authorization'),
            'Content-Type': 'application/json'
          },
        })
        .then(res => {
          if (!res.ok) {
            throw Error(res.statusText);
          }
          return res;
        })
        .then(res => res.json())
        .then(json => {
          req.user = {...json, user_id: json.sub};
          req.user.scope = json.permissions;

          done();
        })
        .catch(err => {
          return res.status(401).json({ message: err.message });
        });
      }
      else {
        if (req.header('Accept') === 'application/json') {
          return res.status(401).json({ message: 'Token could not be verified' });
        }
        res.redirect('/login');
      }
    }
    else {
      res.redirect('/login');
    }
  }
  else {
    done();
  }
};

/**
 * This is called subsequent to the `passport.authenticate` function.
 * `passport` attaches a `user` property to `req`
 */
const checkPermissions = function(permissions) {
  return (req, res, next) => {

    checkAgent(req, res, (err) => {
      if (err) return res.status(403).json({ message: err.message });
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
            return next(err);
          }
          updateDbAndVerify(permissions, req, res, next);
        });
      }
      else {
        // Not a viewer? Assign role
        const managementClient = getManagementClient([apiScope.read.roles].join(' '));
        managementClient.getRoles().then(auth0Roles => {


          // Find viewer role ID
          const roleId = auth0Roles.find(role => role.name === 'viewer').id;

          // 2020-6-23 It is assumed that if an agent is not a viewer, then no other role has been assigned
          managementClient.users.assignRoles({ id: req.user.user_id }, { roles: [roleId] }).then(results => {

            req.user.scope = [...new Set(req.user.scope.concat(roles.viewer))];

            checkForUpdates(req, err => {
              if (err) {
                return next(err);
              }
              updateDbAndVerify(permissions, req, res, next);
            });
          }).catch(err => {
            return next(err);
          });
        }).catch(err => {
          return next(err);
        });
      }
    });
  };
};

module.exports = checkPermissions;

