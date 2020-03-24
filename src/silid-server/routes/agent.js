const express = require('express');
const router = express.Router();
const models = require('../models');
const passport = require('passport');

/**
 * Configs must match those defined for RBAC at Auth0
 */
const scope = require('../config/permissions');
const roles = require('../config/roles');
const checkPermissions = require('../lib/checkPermissions');

/* GET agent listing. */
router.get('/admin', checkPermissions(roles.sudo), function(req, res, next) {
  if (!req.agent.isSuper) {
    return res.status(403).json( { message: 'Forbidden' });
  }

  // Super agent gets entire listing
  models.Agent.findAll().then(results => {
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
    }
    res.json(result);
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.post('/', checkPermissions([scope.create.agents]), function(req, res, next) {
  let agent = new models.Agent({ email: req.body.email });
  agent.save().then(result => {
    res.status(201).json(result);
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.put('/', checkPermissions([scope.update.agents]), function(req, res, next) {
  models.Agent.findOne({ where: { id: req.body.id } }).then(agent => {
    if (!agent) {
      return res.json({ message: 'No such agent' });
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
      return res.json( { message: 'No such agent' });
    }

    if (!req.agent.isSuper && req.agent.email !== agent.email) {
      return res.status(401).json( { message: 'Unauthorized' });
    }

    agent.destroy().then(results => {
      res.json( { message: 'Agent deleted' });
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});

module.exports = router;
