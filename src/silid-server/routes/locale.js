const express = require('express');
const router = express.Router();
const iso6393 = require('iso-639-3')

//const models = require('../models');
//const mailer = require('../mailer');
//const uuid = require('uuid');

//const upsertUpdates = require('../lib/upsertUpdates');

/**
 * Configs must match those defined for RBAC at Auth0
 */
const scope = require('../config/permissions');
//const roles = require('../config/roles');
const checkPermissions = require('../lib/checkPermissions');

const apiScope = require('../config/apiPermissions');
const getManagementClient = require('../lib/getManagementClient');

/**
 * GET /locale
 *
 * This retrieves all living and constructed languages as decided by ISO-639-3
 */
const _languages = [];
router.get('/', checkPermissions([scope.read.agents]), function(req, res, next) {
  // This will only be called once per server execution
  if (!_languages.length) {
    for (let lang of iso6393) {
      if (lang.type === 'living' || lang.type === 'constructed') {
        _languages.push(lang);
      }
    }
  }
  res.status(200).json(_languages);
});

/**
 * PUT /locale/:code
 *
 * Update agent's SIL locale
 */
router.put('/:code', checkPermissions([scope.update.agents]), function(req, res, next) {

  if (!req.user.user_metadata) {
    req.user.user_metadata = {};
  }

  if (req.user.user_metadata.silLocale && req.user.user_metadata.silLocale.iso6393 === req.params.code) {
    return res.status(200).json(req.user);
  }

  const lang = iso6393.find(l => l.iso6393 === req.params.code);

  if (!lang) {
    return res.status(404).json({message: 'That language does not exist'});
  }


  req.user.user_metadata.silLocale = lang;

  // Update user_metadata at Auth0
  const managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
  managementClient.updateUserMetadata({id: req.user.user_id}, req.user.user_metadata).then(agent => {
    res.status(201).json(agent);
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

module.exports = router;
