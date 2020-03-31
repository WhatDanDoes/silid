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


/**
 * 2020-3-27
 *
 * https://community.auth0.com/t/node-managementclient-getuserroles-is-not-a-function/24514
 *
 * @param string
 */
function getAuth0ManagementClient(permissions) {
  const ManagementClient = require('auth0').ManagementClient;
  return new ManagementClient({
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    scope: permissions
  });
}


/* GET agent listing. */
router.get('/admin', checkPermissions(roles.sudo), function(req, res, next) {
  if (!req.agent.isSuper) {
    return res.status(403).json( { message: 'Forbidden' });
  }

  // Super agent gets entire listing
  models.Agent.findAll({ order: [['name', 'ASC']] }).then(results => {
    res.json(results);
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.get('/', checkPermissions([scope.read.agents]), function(req, res, next) {
  return res.json(req.agent);
});

router.get('/:id', checkPermissions([scope.read.agents]), function(req, res, next) {
  models.Agent.findOne({ where: { id: req.params.id } }).then(result => {
    if (!result) {
      result = { message: 'No such agent' };
      return res.status(404).json(result);
    }

    const managementClient = getAuth0ManagementClient(apiScope.read.users);
    managementClient.getUsersByEmail(result.email).then(users => {
      res.status(200).json(result);
    }).catch(err => {
      res.status(err.statusCode).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.post('/', checkPermissions([scope.create.agents]), function(req, res, next) {
  let agent = new models.Agent({ email: req.body.email });
  agent.save().then(result => {

    const managementClient = getAuth0ManagementClient(apiScope.create.users);
    managementClient.createUser({ email: req.body.email, connection: 'Initial-Connection' }).then(users => {
      res.status(201).json(result);
    })
    .catch(err => {
      res.status(err.statusCode).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(500).json(err);
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

      if (result.socialProfile) {
        const managementClient = getAuth0ManagementClient(apiScope.update.users);
        managementClient.updateUser({ id: result.socialProfile.id }, req.body).then(users => {
          res.status(201).json(result);
        })
        .catch(err => {
          res.status(err.statusCode).json(err.message.error_description);
        });
      }
      else {
        res.status(201).json(result);
      }
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
        const managementClient = getAuth0ManagementClient(apiScope.delete.users);
        managementClient.deleteUser({ id: agent.socialProfile.id }, req.body).then(users => {
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
