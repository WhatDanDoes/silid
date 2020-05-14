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
      if (req.agent.isSuper) {
        socialProfile.user_metadata.isSuper = true;
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

      let managementClient = getManagementClient(apiScope.read.users);
      managementClient.getUser({id: socialProfile.user_id}).then(results => {

        models.Agent.update(
          { socialProfile: results, ...updates },
          { returning: true, where: { email: socialProfile.email } }).then(function([rowsUpdate, [updatedAgent]]) {

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
            models.Agent.create({ name: socialProfile.name, email: socialProfile.email, socialProfile: socialProfile }).then(agent => {
              req.agent = agent;

              // This almost certainly superfluous. Revisit
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


/**
 * When an agent is unknown (i.e., has not logged in before), he
 * may have invitations waiting in the database. These need to be
 * handed off to Auth0 user_metadata
 */
function checkForInvites(req, done) {
  models.Invitation.findAll({where: { recipient: req.user.email }, order: [['updatedAt', 'DESC']]}).then(invites => {
    if (invites.length) {
      if (!req.user.user_metadata) {
        req.user.user_metadata = { rsvps: [] };
      }

      if (!req.user.user_metadata.rsvps) {
        req.user.user_metadata.rsvps = [];
      }

      for (let invite of invites) {
        req.user.user_metadata.rsvps.push({ uuid: invite.uuid, type: invite.type, name: invite.name, recipient: invite.recipient });
      }

      managementClient = getManagementClient([apiScope.update.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
      managementClient.updateUser({id: req.user.user_id}, { user_metadata: req.user.user_metadata }).then(result => {

        models.Invitation.destroy({ where: { recipient: req.user.email } }).then(results => {
          done();
        }).catch(err => {
          done(err);
        });
      }).catch(err => {
        done(err);
      });
    }
    else {
      done();
    }
  }).catch(err => {
    done(err);
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
      checkForInvites(req, err => {
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

        managementClient = getManagementClient([apiScope.read.roles, apiScope.update.users].join(' '));
        managementClient.users.assignRoles({ id: req.user.user_id }, { roles: [roleId] }).then(results => {
          req.user.scope = [...new Set(req.user.scope.concat(roles.viewer))];

          checkForInvites(req, err => {
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

