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
router.get('/admin/:page?/:cached?', checkPermissions(roles.sudo), function(req, res, next) {
  if (!req.agent.isSuper) {
    return res.status(403).json( { message: 'Forbidden' });
  }

  let viewCached = false;
  let page = 0;
  if (req.params.page) {
    if (req.params.page === 'cached') {
      viewCached = true;
    }
    else {
      page = parseInt(req.params.page);
    }
  }

  // Super agent gets entire listing
  if (req.params.cached || viewCached) {
    models.Agent.findAll({ attributes: ['socialProfile', 'id'],
                           where: { socialProfile: { [models.Sequelize.Op.ne]: null} },
                           order: [['name', 'ASC']],
                           limit: 30,
                           offset: page * 30 }).
                        then(results => {
      const profiles = results.map(p => { return {...p.socialProfile, id: p.id }; });
      models.Agent.count({ where: { socialProfile: { [models.Sequelize.Op.ne]: null} } }).then(count => {
        res.json({ users: profiles, start: page, limit: 30, length: profiles.length, total: count });
      }).catch(err => {
        res.status(500).json(err);
      });
    }).catch(err => {
      res.status(500).json(err);
    });
  }
  else {
    const managementClient = getManagementClient(apiScope.read.users);
    managementClient.getUsers({ page: page, per_page: 30, include_totals: true }).then(agents => {
      res.status(200).json(agents);
    }).catch(err => {
      res.status(err.statusCode).json(err.message.error_description);
    });
  }
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
  let managementClient = getManagementClient(apiScope.read.users);
  managementClient.getUser({id: req.user.user_id}).then(agent => {

    // Read agent's assigned roles
    managementClient = getManagementClient([apiScope.read.users, apiScope.read.roles].join(' '));
    managementClient.getUserRoles({id: agent.user_id}).then(roles => {

      const nullsFound = checkForNulls(agent);
      if (nullsFound) {
        managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
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

router.get('/:id', checkPermissions([scope.read.agents]), function(req, res, next) {
  let managementClient = getManagementClient(apiScope.read.users);
  managementClient.getUser({id: req.params.id}).then(agent => {

    // Read agent's assigned roles
    managementClient = getManagementClient([apiScope.read.users, apiScope.read.roles].join(' '));
    managementClient.getUserRoles({id: agent.user_id}).then(roles => {

      const nullsFound = checkForNulls(agent);
      if (nullsFound) {
        managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
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

router.put('/', checkPermissions([scope.update.agents]), function(req, res, next) {
  models.Agent.findOne({ where: { id: req.body.id } }).then(agent => {
    if (!agent) {
      return res.status(404).json({ message: 'No such agent' });
    }

    if (!req.agent.isSuper && req.agent.email !== agent.email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    for (let key in req.body) {
      if (agent[key] || agent[key] === null) {
        agent[key] = req.body[key];
      }
    }

    agent.save().then(result => {
      res.status(201).json(result);
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.delete('/', checkPermissions([scope.delete.agents]), function(req, res, next) {
  models.Agent.findOne({ where: { id: req.body.id } }).then(agent => {
    if (!agent) {
      return res.status(404).json( { message: 'No such agent' });
    }

    if (!req.agent.isSuper && req.agent.email !== agent.email) {
      return res.status(401).json( { message: 'Unauthorized' });
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

module.exports = router;
