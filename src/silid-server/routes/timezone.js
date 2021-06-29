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

  /**
   * 2020-9-3
   *
   * This suggests `zoneinfo` is part of the OpenID standard:
   *
   * https://openid.net/specs/openid-connect-basic-1_0.html
   *
   * This error says this is not true of Auth0 (we are using
   * OpenID, aren't we?)
   *
   * `Bad Request: Payload validation error:
   *  'Additional properties not allowed:
   *  zoneinfo (consider storing them in app_metadata
   *  or user_metadata. See "Users Metadata"
   *  in https://auth0.com/docs/api/v2/changes for more details`
   *
   * Link is broken, btw.
   *
   * Also noted in accompanying tests
   */
  //const managementClient = getManagementClient(apiScope.update.users);
  //managementClient.updateUser({id: req.params.id}, { zoneinfo: timezone.name }).then(agent => {
  //  res.status(201).json(agent);
  //}).catch(err => {
  //  res.status(err.statusCode).json(err.message.error_description);
  //});
  const managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
  managementClient.updateUser({id: req.params.id}, { user_metadata: { zoneinfo: timezone } }).then(result => {
    // Is this a sudo agent updating another?
    if (req.params.id !== req.user.user_id) {
      managementClient.getUserRoles({id: req.params.id}).then(assignedRoles => {
        result.roles = assignedRoles;
        res.status(201).json(result);
      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });
    }
    else {
      // Update session data
      if (req.session.passport) {
        req.session.passport.user = {...req.user, ...result};
      }
      res.status(201).json({...req.user, ...result});
    }
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

module.exports = router;
