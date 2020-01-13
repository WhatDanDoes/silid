const express = require('express');
const router = express.Router();
const jwtAuth = require('../lib/jwtAuth');
const models = require('../models');

/* GET agent listing. */
router.get('/', jwtAuth, function(req, res, next) {
  res.json(req.agent);
});

router.get('/:id', jwtAuth, function(req, res, next) {
  models.Agent.findOne({ where: { id: req.params.id }, attributes: { exclude: ['accessToken'] } }).then(result => {
    if (!result) {
      result = { message: 'No such agent' };
    }
    res.json(result);
  }).catch(err => {
    res.json(err);
  });
});

router.post('/', jwtAuth, function(req, res, next) {
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

router.put('/', jwtAuth, function(req, res, next) {
  models.Agent.findOne({ where: { id: req.body.id }, attributes: { exclude: ['accessToken'] } }).then(agent => {
    if (!agent) {
      return res.json( { message: 'No such agent' });
    }

    if (req.agent.email !== agent.email) {
      return res.status(401).json( { message: 'Unauthorized: Invalid token' });
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

router.delete('/', jwtAuth, function(req, res, next) {
  models.Agent.findOne({ where: { id: req.body.id } }).then(agent => {
    if (!agent) {
      return res.json( { message: 'No such agent' });
    }

    if (req.agent.email !== agent.email) {
      return res.status(401).json( { message: 'Unauthorized: Invalid token' });
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
