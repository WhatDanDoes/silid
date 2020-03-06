const express = require('express');
const router = express.Router();
const sessionAuth = require('../lib/sessionAuth');
const models = require('../models');
const passport = require('passport');

/* GET agent listing. */
router.get('/', sessionAuth, function(req, res, next) {
  if (!req.agent.isSuper) {
    return res.json(req.agent);
  }

  // Super agent gets entire listing
  models.Agent.findAll().then(results => {
    res.json(results);
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.get('/:id', sessionAuth, function(req, res, next) {
  models.Agent.findOne({ where: { id: req.params.id } }).then(result => {
    if (!result) {
      result = { message: 'No such agent' };
    }

    // Root agent can only be viewed by other super agents
    if (!req.agent.isSuper && result.email === process.env.ROOT_AGENT) {
      return res.status(401).json( { message: 'Unauthorized' });
    }

    res.json(result);
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.post('/', sessionAuth, function(req, res, next) {
  let agent = new models.Agent({ email: req.body.email });
  agent.save().then(result => {
    res.status(201).json(result);
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.put('/', sessionAuth, function(req, res, next) {
  models.Agent.findOne({ where: { id: req.body.id } }).then(agent => {
    if (!agent) {
      return res.json({ message: 'No such agent' });
    }

    if (!req.agent.isSuper && req.agent.email !== agent.email) {
      return res.status(401).json( { message: 'Unauthorized' });
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

router.delete('/', sessionAuth, function(req, res, next) {
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
