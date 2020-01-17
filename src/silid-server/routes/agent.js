const express = require('express');
const router = express.Router();
const sessionAuth = require('../lib/sessionAuth');
const models = require('../models');
const passport = require('passport');

/* GET agent listing. */
router.get('/', sessionAuth, function(req, res, next) {
  res.json(req.agent);
});

router.get('/:id', sessionAuth, function(req, res, next) {
  models.Agent.findOne({ where: { id: req.params.id } }).then(result => {
    if (!result) {
      result = { message: 'No such agent' };
    }
    res.json(result);
  }).catch(err => {
    res.json(err);
  });
});

router.post('/', sessionAuth, function(req, res, next) {
  let email = req.body.email;
  if (req.body.email) {
    email = req.body.email;
  }
  let agent = new models.Agent({ email: email });
  agent.save().then(result => {
    res.status(201).json(result);
  }).catch(err => {
    res.json(err);
  });
});

router.put('/', sessionAuth, function(req, res, next) {
  models.Agent.findOne({ where: { id: req.body.id } }).then(agent => {
    if (!agent) {
      return res.json( { message: 'No such agent' });
    }

    if (req.agent.email !== agent.email) {
      return res.status(401).json( { message: 'Unauthorized' });
    }

    for (let key in req.body) {
      if (agent[key]) {
        agent[key] = req.body[key];
      }
    }
    agent.save().then(result => {
      res.status(201).json(result);
    }).catch(err => {
      res.json(err);
    });
  }).catch(err => {
    res.json(err);
  });
});

router.delete('/', sessionAuth, function(req, res, next) {
  models.Agent.findOne({ where: { id: req.body.id } }).then(agent => {
    if (!agent) {
      return res.json( { message: 'No such agent' });
    }

    if (req.agent.email !== agent.email) {
      return res.status(401).json( { message: 'Unauthorized' });
    }

    agent.destroy().then(results => {
      res.json( { message: 'Agent deleted' });
    }).catch(err => {
      res.json(err);
    });   
  }).catch(err => {
    res.json(err);
  });
});

module.exports = router;
