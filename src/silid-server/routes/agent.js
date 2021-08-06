const express = require('express');
const router = express.Router();
const models = require('../models');
const passport = require('passport');

/**
 * Configs must match those defined for RBAC at Auth0
 */
const scope = require('../config/permissions');
const apiScope = require('../config/apiPermissions');
const roles = require('../config/roles');
const checkPermissions = require('../lib/checkPermissions');

const getManagementClient = require('../lib/getManagementClient');

/* GET agent listing. */
router.get('/admin/:page?', checkPermissions(roles.organizer), function(req, res, next) {

  if (!req.user.isSuper && !req.user.isOrganizer) {
    return res.status(403).json({ message: 'Insufficient scope' });
  }

  let page = 0;
  if (req.params.page) {
    page = parseInt(req.params.page);
  }

  const managementClient = getManagementClient(apiScope.read.users);
  managementClient.getUsers({ page: page, per_page: 30, include_totals: true }).then(agents => {
    res.status(200).json(agents);
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

/**
 * Direct manipulation of user_metadata has caused inconsistencies, which cause crashes.
 * The following strips any null values that may have been unwittingly introduced.
 *
 * @param object
 * @return boolean
 */
function checkForNulls(agent) {
  let nullsFound = false;
  if (agent.user_metadata) {

    if (agent.user_metadata.teams) {
      const teams = agent.user_metadata.teams.filter(team => !!team);
      if (teams.length < agent.user_metadata.teams.length) {
        nullsFound = true;
        agent.user_metadata.teams = teams;
      }
    }

    if (agent.user_metadata.rsvps) {
      const rsvps = agent.user_metadata.rsvps.filter(rsvp => !!rsvp);
      if (rsvps.length < agent.user_metadata.rsvps.length) {
        nullsFound = true;
        agent.user_metadata.rsvps = rsvps;
      }
    }

    if (agent.user_metadata.pendingInvitations) {
      const pendingInvitations = agent.user_metadata.pendingInvitations.filter(rsvp => !!rsvp);
      if (pendingInvitations.length < agent.user_metadata.pendingInvitations.length) {
        nullsFound = true;
        agent.user_metadata.pendingInvitations = pendingInvitations;
      }
    }
  }

  return nullsFound;
};

router.get('/', checkPermissions([scope.read.agents]), function(req, res, next) {
  const managementClient = getManagementClient(apiScope.read.users);
  managementClient.getUser({id: req.user.user_id}).then(agent => {

    // Read agent's assigned roles
    managementClient.getUserRoles({id: agent.user_id}).then(roles => {
      roles.sort((a, b) => a.name < b.name ? -1 : 1);

      const nullsFound = checkForNulls(agent);
      if (nullsFound) {
        managementClient.updateUser({id: agent.user_id}, { user_metadata: agent.user_metadata }).then(agent => {
          const refreshedAgent = {...req.user, roles: roles, ...{...agent, user_metadata: {...req.user.user_metadata, ...agent.user_metadata} } };
          res.status(201).json(refreshedAgent);
        }).catch(err => {
          res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
        });
      }
      else {
        const refreshedAgent = {...req.user, roles: roles, ...{...agent, user_metadata: {...req.user.user_metadata, ...agent.user_metadata} } };
        res.status(200).json(refreshedAgent);
      }
    }).catch(err => {
      res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.get('/profiles/:email?', checkPermissions([scope.read.agents]), function(req, res, next) {
  let email = req.user.email;
  if (req.params.email) {
    if (req.user.isOrganizer || req.user.isSuper) {
      email = req.params.email;
    }
    else {
      return res.status(403).json({message: 'Forbidden'});
    }
  }

  const managementClient = getManagementClient(apiScope.read.users);
  managementClient.getUsersByEmail(email).then(agents => {

    // You can only link verified accounts
    agents = agents.filter(a => a.email_verified);

    // Make sure primary account is verified
    if (req.params.email) {
      let primary = agents.find(a => a.email === req.params.email);
      if (!primary) {
        return res.status(400).json({message: 'Primary email is not verified'});
      }
    }

    res.status(200).json(agents);
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

/**
 * Link accounts
 */
router.put('/link/:primary_id?', checkPermissions([scope.update.agents]), function(req, res, next) {
  let primaryId = req.user.user_id;
  if (req.params.primary_id) {
    if (req.user.isOrganizer || req.user.isSuper) {
      primaryId = req.params.primary_id;
    }
    else {
      return res.status(403).json({message: 'Forbidden'});
    }
  }

  const managementClient = getManagementClient(apiScope.update.users);
  managementClient.linkUsers(primaryId, req.body).then(identities => {
    res.status(201).json(identities);
  }).catch(err => {
    res.status(err.statusCode).json({ message: JSON.parse(err.message).error_description });
  });
});

/**
 * Unlink accounts
 */
router.delete('/link/:provider/:user_id/:primary_id?', checkPermissions([scope.update.agents]), function(req, res, next) {
  let primaryId = req.user.user_id;
  if (req.params.primary_id) {
    if (req.user.isOrganizer || req.user.isSuper) {
      primaryId = req.params.primary_id;
    }
    else {
      return res.status(403).json({message: 'Forbidden'});
    }
    delete req.params.primary_id;
  }

  const managementClient = getManagementClient(apiScope.update.users);
  managementClient.unlinkUsers({...req.params, id: primaryId }).then(identity => {

    // So the account doesn't get relinked because of the Auth0 account linking rule
    managementClient.updateUserMetadata({id: `${req.params.provider}|${req.params.user_id}`}, { manually_unlinked: true }).then(response => {

      res.status(200).json(identity);
    }).catch(err => {
      // Maybe this should just return the new identity... if it fails at this point,
      // the account has still been successfully unlinked (though it will probably be
      // relinked on next login)
      res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(err.statusCode).json({ message: JSON.parse(err.message).error_description });
  });
});

router.get('/:id', checkPermissions([scope.read.agents]), function(req, res, next) {
  const managementClient = getManagementClient(apiScope.read.users);
  managementClient.getUser({id: req.params.id}).then(agent => {

    // Read agent's assigned roles
    managementClient.getUserRoles({id: agent.user_id}).then(roles => {
      roles.sort((a, b) => a.name < b.name ? -1 : 1);

      const nullsFound = checkForNulls(agent);
      if (nullsFound) {
        managementClient.updateUser({id: req.params.id}, { user_metadata: agent.user_metadata }).then(result => {
          res.status(201).json({ ...result, roles: roles });
        }).catch(err => {
          res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
        });
      }
      else {
        res.status(200).json({ ...agent, roles: roles });
      }
    }).catch(err => {
      res.status(err.statusCode).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.post('/', checkPermissions([scope.create.agents]), function(req, res, next) {
  const managementClient = getManagementClient(apiScope.create.users);
  managementClient.createUser({ ...req.body, connection: 'Initial-Connection' }).then(result => {
    res.status(201).json(result);
  })
  .catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.delete('/', checkPermissions([scope.delete.agents]), function(req, res, next) {
  models.Agent.findOne({ where: { id: req.body.id } }).then(agent => {
    if (!agent) {
      return res.status(404).json({ message: 'No such agent' });
    }

    if (!req.user.isSuper && req.user.email !== agent.email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    agent.destroy().then(results => {

      if (agent.socialProfile) {
        const managementClient = getManagementClient(apiScope.delete.users);
        managementClient.deleteUser({ id: agent.socialProfile.user_id }, req.body).then(users => {
          res.status(201).json({ message: 'Agent deleted' });
        })
        .catch(err => {
          res.status(err.statusCode).json(err.message.error_description);
        });
      }
      else {
        res.status(201).json({ message: 'Agent deleted' });
      }
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.post('/verify', checkPermissions([scope.update.agents]), function(req, res, next) {
  if (req.user.email_verified) {
    return res.status(200).json({ message: 'Email already verified' });
  }
  const managementClient = getManagementClient(apiScope.update.users);
  managementClient.jobs.verifyEmail({ user_id: req.body.id }).then(result => {
    res.status(201).json({ message: 'Verification sent. Check your email' });
  })
  .catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.patch('/:id', checkPermissions([scope.update.agents]), function(req, res, next) {
  if (req.params.id !== req.user.user_id && !req.user.isSuper) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  /**
   * 2020-8-19 As per: https://auth0.com/docs/users/user-profile-structure (some omitted)
   *
   * It has become necessary to distinguish root-level claims from what I call
   * _pseudo_ root-level claims. The `phone_number` claim motivates this
   * effort. Though `phone_number` is an OIDC standard claim, it only applies
   * to SMS users at Auth0. As such, it is being slotted into `user_metadata`.
   */
  const filteredRootClaims = {};
  ['blocked',
   'email_verified',
   'family_name',
   'given_name',
   'name',
   'nickname',
   'picture'].forEach(claim => {
    if (req.body[claim]) {
      filteredRootClaims[claim] = req.body[claim];
    }
  });

  const filteredPseudoRootClaims = {};
  ['phone_number'].forEach(claim => {
    if (req.body[claim]) {
      filteredPseudoRootClaims[claim] = req.body[claim];
    }
  });

  if (!Object.keys(filteredRootClaims).length && !Object.keys(filteredPseudoRootClaims).length) {
    return res.status(200).json({ message: 'No relevant data supplied' });
  }

  const managementClient = getManagementClient([apiScope.update.users].join());
  managementClient.updateUser({id: req.params.id}, {...filteredRootClaims, user_metadata: Object.keys(filteredPseudoRootClaims).length ? filteredPseudoRootClaims : undefined}).then(agent => {

    // Is this a sudo agent updating another?
    if (req.params.id !== req.user.user_id) {
      managementClient.getUserRoles({id: req.params.id}).then(assignedRoles => {
        agent.roles = assignedRoles;
        res.status(201).json(agent);
      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });
    }
    else {
      // Update session data if it exists
      if (req.session.passport) {
        req.session.passport.user = {...req.user, ...agent};
      }

      res.status(201).json({...req.user, ...agent});
    }
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

module.exports = router;
