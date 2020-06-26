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
  if (!req.user.isSuper) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  let managementClient = getManagementClient([apiScope.read.roles].join(' '));
  managementClient.getRoles().then(auth0Roles => {
    res.status(200).json(auth0Roles);
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.put('/:id/agent/:agentId', checkPermissions(roles.sudo), (req, res, next) => {
  let managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUser({id: req.params.agentId}).then(agent => {
    if (!agent) {
      return res.status(404).json({ message: 'No such agent' });
    }

    // Get the roles assigned to the retrieved agent
    managementClient.getUserRoles({id: req.params.agentId}).then(assignedRoles => {
      for (let role of assignedRoles) {
        if (role.id === req.params.id) {
          return res.status(200).json({ message: 'Role already assigned' });
        }
      }

      // Get all assignable roles
      managementClient.getRoles().then(auth0Roles => {
        const newRole = auth0Roles.find(r => r.id === req.params.id);
        if (!newRole) {
          return res.status(404).json({ message: 'No such role' });
        }
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
    if (err.statusCode === 404) {
      return res.status(404).json({ message: 'No such agent' });
    }
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.delete('/:id/agent/:agentId', checkPermissions(roles.sudo), (req, res, next) => {
  let managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUser({id: req.params.agentId}).then(agent => {
    if (!agent) {
      return res.status(404).json({ message: 'No such agent' });
    }
    // Get the roles assigned to the retrieved agent
    managementClient.getUserRoles({id: req.params.agentId}).then(assignedRoles => {
      const roleIndex = assignedRoles.findIndex(r => r.id === req.params.id);
      if (roleIndex < 0) {
        return res.status(404).json({ message: 'Role not assigned' });
      }

      assignedRoles.splice(roleIndex, 1);
      assignedRoles.sort((a, b) => a.name < b.name ? -1 : 1);

      // Update agent roles
      managementClient.removeRolesFromUser({ id: req.params.agentId }, { roles: [req.params.id] }).then(results => {
        res.status(201).json({ ...agent, roles: assignedRoles });
      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });

    }).catch(err => {
      res.status(err.statusCode).json(err.message.error_description);
    });

  }).catch(err => {
    if (err.statusCode === 404) {
      return res.status(404).json({ message: 'No such agent' });
    }
    res.status(err.statusCode).json(err.message.error_description);
  });
});

module.exports = router;
