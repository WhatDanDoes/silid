const express = require('express');
const router = express.Router();

/**
 * Configs must match those defined for RBAC at Auth0
 */
const scope = require('../config/permissions');
const apiScope = require('../config/apiPermissions');
const roles = require('../config/roles');
const checkPermissions = require('../lib/checkPermissions');

const getManagementClient = require('../lib/getManagementClient');

/* GET list of assignable roles */
router.get('/', checkPermissions(roles.sudo), (req, res, next) => {
  if (!req.agent.isSuper) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  let managementClient = getManagementClient([apiScope.read.roles].join(' '));
  managementClient.getRoles().then(auth0Roles => {
    res.status(201).json(auth0Roles);
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.put('/:id/agent/:agentId', checkPermissions(roles.sudo), (req, res, next) => {
  let managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUser({id: req.params.agentId}).then(agent => {

    // Get the roles assigned to the retrieved agent
    managementClient.getUserRoles({id: req.params.agentId}).then(assignedRoles => {

      // Get all assignable roles
      managementClient.getRoles().then(auth0Roles => {
        const newRole = auth0Roles.find(r => r.id === req.params.id);
        assignedRoles.push(newRole);
        assignedRoles.sort((a, b) => a.name < b.name ? -1 : 1);

        // Update agent roles
        managementClient.users.assignRoles({ id: req.params.agentId }, { roles: assignedRoles.map(r => r.id) }).then(results => {
          res.status(201).json({ ...agent, roles: assignedRoles });
        }).catch(err => {
          res.status(err.statusCode).json(err.message.error_description);
        });
      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });
    }).catch(err => {
      res.status(err.statusCode).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

module.exports = router;
