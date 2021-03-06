const express = require('express');
const router = express.Router();
const iso6393 = require('iso-639-3');
const bcp47 = require('bcp47');
const path = require('path');
const fs = require('fs');

/**
 * Configs must match those defined for RBAC at Auth0
 */
const scope = require('../config/permissions');
const checkPermissions = require('../lib/checkPermissions');

const apiScope = require('../config/apiPermissions');
const getManagementClient = require('../lib/getManagementClient');

/**
 * GET /locale
 *
 * This retrieves all living and constructed languages as decided by ISO-639-3
 */
const _languages = [];
// This will only be called once per server execution
if (!_languages.length) {
  for (let lang of iso6393) {
    if (lang.type === 'living' || lang.type === 'constructed') {
      _languages.push(lang);
    }
  }
  _languages.sort((a, b) => a.name < b.name ? -1 : 1);
}

router.get('/', checkPermissions([scope.read.agents]), function(req, res, next) {
  res.status(200).json(_languages);
});


/**
 * GET /locale/supported
 *
 * This retrieves only the supported languages
 */
const _supportedLanguages = [];
const languageDirectory = path.resolve(__dirname, '../public/languages');

// This will only be called once per server execution
if (!_supportedLanguages.length) {
  fs.readdir(languageDirectory, (err, files) => {
    if (err) return console.error('Could not retrieve supported languages');
    // Gets rid of _hidden_ files and the like
    files = files.filter(item => !(/(^|\/)\.[^\/\.]/g).test(item));

    for (let file of files) {
      for (let lang of iso6393) {
        if (lang.iso6393 === file.split('.')[0]) {
          _supportedLanguages.push(lang);
        }
      }
    }
  });
  _supportedLanguages.sort((a, b) => a.name < b.name ? -1 : 1);
}

router.get('/supported', checkPermissions([scope.read.agents]), function(req, res, next) {
  res.status(200).json(_supportedLanguages);
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

  let lang = iso6393.find(l => l.iso6393 === req.params.code);

  if (!lang) {

    /**
     * Is this BCP-47 shorthand?
     */
    const bcpParsed = bcp47.parse(req.params.code);

    if (!bcpParsed) {
      return res.status(404).json({message: 'That language does not exist'});
    }

    // BCP-47 uses iso-639-1
    lang = iso6393.find(l => l.iso6391 === bcpParsed.langtag.language.language);

    if (!lang) {
      return res.status(404).json({message: 'That language does not exist'});
    }
  }

  if (req.session.passport) {
    req.session.passport.user.user_metadata.silLocale = lang;
  }
  else {
    req.user.user_metadata.silLocale = lang;
  }

  // Update user_metadata at Auth0
  const managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
  managementClient.updateUserMetadata({id: req.user.user_id}, req.user.user_metadata).then(agent => {
    // 2021-2-25 https://github.com/expressjs/session/issues/660
    // Session needs to be saved prior to redirect
    if (req.session.passport) {
      req.session.save(err => {
        if (err) return next(err);

        res.redirect(303, '/agent');
      });
    }
    else {
      res.redirect(303, '/agent');
    }
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

module.exports = router;
