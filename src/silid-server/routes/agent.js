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
      const profiles = results.map(p => { return {...p.socialProfile._json, id: p.id }; });
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

router.get('/', checkPermissions([scope.read.agents]), function(req, res, next) {
  const managementClient = getManagementClient(apiScope.read.users);
  managementClient.getUser({id: req.user.user_id}).then(agent => {
    res.status(200).json(agent);
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.get('/:id/:cached?', checkPermissions([scope.read.agents]), function(req, res, next) {

  if (req.params.cached && req.agent.isSuper) {
    models.Agent.findOne({ where: { id: req.params.id } }).then(result => {
      if (!result) {
        result = { message: 'No such agent' };
        return res.status(404).json(result);
      }

      const managementClient = getManagementClient(apiScope.read.users);
      managementClient.getUsersByEmail(result.email).then(users => {
        res.status(200).json(result);
      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });
    }).catch(err => {
      res.status(500).json(err);
    });
  }
  else if (req.params.cached && !req.agent.isSuper) {
    return res.status(403).json( { message: 'Forbidden' });
  }
  else {
    const managementClient = getManagementClient(apiScope.read.users);
    managementClient.getUser({id: req.params.id}).then(agent => {
      res.status(200).json(agent);
    }).catch(err => {
      res.status(err.statusCode).json(err.message.error_description);
    });
  }
});

router.post('/', checkPermissions([scope.create.agents]), function(req, res, next) {
//2020-4-8
//  let agent = new models.Agent({ email: req.body.email });
//  agent.save().then(result => {

  const managementClient = getManagementClient(apiScope.create.users);
  managementClient.createUser({ ...req.body, connection: 'Initial-Connection' }).then(result => {
    res.status(201).json(result);
  })
  .catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });


//  }).catch(err => {
//    res.status(500).json(err);
//  });
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

// 2020-4-8 Saving for later. Cf., `spec/agentSpec`
//      if (result.socialProfile) {
//        const managementClient = getManagementClient(apiScope.update.users);
//        managementClient.updateUser({ id: result.socialProfile.id }, req.body).then(users => {
          res.status(201).json(result);
//        })
//        .catch(err => {
//          res.status(err.statusCode).json(err.message.error_description);
//        });
//      }
//      else {
//        res.status(201).json(result);
//      }
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
