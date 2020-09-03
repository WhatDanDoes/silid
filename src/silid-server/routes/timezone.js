const express = require('express');
const router = express.Router();
const ct = require('countries-and-timezones')

/**
 * Configs must match those defined for RBAC at Auth0
 */
const scope = require('../config/permissions');
const checkPermissions = require('../lib/checkPermissions');

const apiScope = require('../config/apiPermissions');
const getManagementClient = require('../lib/getManagementClient');


/**
 * GET /timezone
 */
const _timezones = [];
// This will only be called once per server execution
if (!_timezones.length) {
  const allZones = ct.getAllTimezones();
  for (let name in allZones) {
    if (allZones[name].country) {
      _timezones.push(allZones[name]);
    }
  }
  _timezones.sort((a, b) => a.name < b.name ? -1 : 1);
}
router.get('/', checkPermissions([scope.read.agents]), function(req, res, next) {
  res.status(200).json(_timezones);
});

/**
 * PUT /timezone/:id
 *
 * Update agent's timezone
 */
router.put('/:id', checkPermissions([scope.update.agents]), function(req, res, next) {

  if (req.params.id !== req.user.user_id && !req.user.isSuper) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const timezone = _timezones.find(z => z.name === req.body.timezone);

  if (!timezone) {
    return res.status(404).json({message: 'That timezone does not exist'});
  }

  const managementClient = getManagementClient(apiScope.update.users);
  managementClient.updateUser({id: req.params.id}, { zoneinfo: timezone.name }).then(agent => {
    res.status(201).json(agent);
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

module.exports = router;
