const express = require('express');
const router = express.Router();
const sessionAuth = require('../lib/sessionAuth');
const models = require('../models');
const mailer = require('../mailer');

/* GET team listing. */
router.get('/', sessionAuth, function(req, res, next) {
  req.agent.getTeams().then(teams => {
    res.status(200).json(teams);
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.get('/:id', sessionAuth, function(req, res, next) {
  models.Team.findOne({ where: { id: req.params.id },
                        include: [ { model: models.Agent, as: 'creator' },
                                   { model: models.Agent, as: 'members' },
                                   'organization'] }).then(team => {
    if (!team) {
      return res.status(404).json({ message: 'No such team' });
    }
    let teamMembers = team.members.map(agent => agent.email);
    team.getOrganization().then(org => {
      org.getMembers().then(orgMembers => {
        orgMembers = orgMembers.map(agent => agent.email);
        if (!teamMembers.includes(req.agent.email) && !orgMembers.includes(req.agent.email)) {
          return res.status(403).json({ message: 'You are not a member of that team' });
        }
        res.status(200).json(team);
      }).catch(err => {
        res.status(500).json(err);
      });
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.post('/', sessionAuth, function(req, res, next) {
  if (!req.body.organizationId) {
    return res.status(400).json({ errors: [{ message: 'No organization provided' }] });
  }

  models.Organization.findOne({ where: { id: req.body.organizationId } }).then(organization => {

    if (!organization) {
      return res.status(404).json({ errors: [{ message: 'That organization doesn\'t exist' }] });
    }

    organization.getMembers({attributes: ['email']}).then(agents => {
      // 2019-11-1 https://github.com/sequelize/sequelize/issues/6950#issuecomment-373937803
      // Sequelize doesn't return a flat array
      agents = agents.map(agent => agent.email);
      organization.getCreator().then(creator => {

        if (creator.email !== req.agent.email && !agents.includes(req.agent.email)) {
          return res.status(401).json( { message: 'Unauthorized' });
        }
        req.body.creatorId = req.agent.id;

        let team = new models.Team(req.body);
        team.save().then(result => {
          res.status(201).json(result);
        }).catch(err => {
          let status = 500;
          if (err instanceof models.Sequelize.UniqueConstraintError) {
            status = 200;
          }
          res.status(status).json(err);
        });
      }).catch(err => {
        res.status(500).json(err);
      });
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.put('/', sessionAuth, function(req, res, next) {
  models.Team.findOne({where: {id: req.body.id}}).then(team => {
    if (!team) {
      return res.json( { message: 'No such team' });
    }
    team.getOrganization().then(organization => {
      team.getCreator().then(teamCreator => {
        organization.getCreator().then(creator => {

          if (creator.email !== req.agent.email && teamCreator.email !== req.agent.email) {
            return res.status(403).json( { message: 'Unauthorized' });
          }
          for (let key in req.body) {
            if (team[key]) {
              team[key] = req.body[key];
            }
          }

          team.save().then(result => {
            res.status(201).json(result);
          }).catch(err => {
            res.status(500).json(err);
          });
        }).catch(err => {
          res.status(500).json(err);
        });
      }).catch(err => {
        res.status(500).json(err);
      });
    }).catch(err => {
      res.json(err);
    });
  }).catch(err => {
    res.json(err);
  });
});

router.delete('/:id', sessionAuth, function(req, res, next) {
  models.Team.findOne({ where: { id: req.params.id } }).then(team => {
    if (!team) {
      return res.status(404).json( { message: 'No such team' });
    }

    team.getCreator().then(teamCreator => {

      team.getOrganization().then(organization => {

        organization.getCreator().then(creator => {

          if (creator.email !== req.agent.email && teamCreator.email !== req.agent.email) {
            return res.status(403).json( { message: 'Unauthorized' });
          }

          team.destroy().then(results => {
            res.status(201).json({ message: 'Team deleted' });
          }).catch(err => {
            res.status(500).json(err);
          });
        }).catch(err => {
          res.status(500).json(err);
        });
      }).catch(err => {
        res.status(500).json(err);
      });
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});

/**
 * PATCH is used to modify associations (i.e., memberships and orgs).
 * cf., PUT
 */
const patchTeam = function(req, res, next) {
  models.Team.findOne({ where: { id: req.body.id },
                                 include: ['members', 'organization', 'creator'] }).then(team => {
    if (!team) {
      return res.status(404).json( { message: 'No such team' });
    }

    let members = team.members.map(member => member.id);
    if (!members.includes(req.agent.id)) {
      return res.status(403).json( { message: 'You are not a member of this team' });
    }

    // Agent membership
    let memberStatus = 'now a';
    if (req.body.memberId) {
      const index = members.indexOf(req.body.memberId);
      // Delete
      if (index > -1) {
        memberStatus = 'no longer a';
        members.splice(index, 1);
      }
      // Add
      else {
        members.push(req.body.memberId);
      }
    }

    team.setMembers(members).then(results => {
      models.Agent.findOne({ where: { id: req.body.memberId } }).then(agent => {
        let mailOptions = {
          to: agent.email,
          from: process.env.NOREPLY_EMAIL,
          subject: 'Identity membership update',
          text: `You are ${memberStatus} member of ${team.name}`
        };
        mailer.transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Mailer Error', error);
            return res.status(501).json(error);
          }
          res.status(201).json({ message: 'Update successful' });
        });
      }).catch(err => {
        res.status(500).json(err);
      });
    }).catch(err => {
      let status = 500;
      if (err instanceof models.Sequelize.ForeignKeyConstraintError) {
        status = 404;
        if (err.parent.table === 'TeamMembers') {
          err = { message: 'No such agent' }
        }
      }
      res.status(status).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
}

router.patch('/', sessionAuth, function(req, res, next) {
  if (req.body.email) {
    models.Agent.findOne({ where: { email: req.body.email } }).then(agent => {
      if (!agent) {
        let newAgent = new models.Agent({ email: req.body.email });
        newAgent.save().then(result => {
          req.body.memberId = result.id;
          patchTeam(req, res, next);
        }).catch(err => {
          res.json(err);
        });
      }
      else {
        req.body.memberId = agent.id;
        patchTeam(req, res, next);
      }
    }).catch(err => {
      res.status(500).json(err);
    });
  }
  else {
    patchTeam(req, res, next);
  }
});

router.put('/:id/agent', sessionAuth, function(req, res, next) {
  models.Team.findOne({ where: { id: req.params.id },
                                 include: [ 'creator',
                                            { model: models.Agent, as: 'members' },
                                            'organization'] }).then(team => {

    if (!team) {
      return res.status(404).json( { message: 'No such team' });
    }

    if (!team.members.map(member => member.id).includes(req.agent.id)) {
      return res.status(403).json({ message: 'You are not a member of this team' });
    }

    models.Agent.findOne({ where: { email: req.body.email } }).then(agent => {

      const mailOptions = {
        from: process.env.NOREPLY_EMAIL,
        subject: 'Identity team invitation',
        text: `You have been invited to join ${team.name}

Click or copy-paste the link below to accept:

`
      };

      if (!agent) {
        let newAgent = new models.Agent({ email: req.body.email });
        newAgent.save().then(result => {
          team.addMember(newAgent.id).then(result => {
            mailOptions.text += `${process.env.SERVER_DOMAIN}/verify/${result[0].verificationCode}\n`;
            mailOptions.to = newAgent.email;
            mailer.transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error('Mailer Error', error);
                return res.status(501).json(error);
              }
              res.status(201).json(newAgent);
            });
          }).catch(err => {
            res.status(500).json(err);
          })
        }).catch(err => {
          res.status(500).json(err);
        });
      }
      else {
        if (team.members.map(a => a.id).includes(agent.id)) {
          return res.status(200).json({ message: `${agent.email} is already a member of this team` });
        }

        team.addMember(agent.id).then(result => {

          mailOptions.to = agent.email;
          mailer.transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error('Mailer Error', error);
              return res.status(501).json(error);
            }
            res.status(201).json(agent);
          });
        }).catch(err => {
          res.status(500).json(err);
        });
      }
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});


router.delete('/:id/agent/:agentId', sessionAuth, function(req, res, next) {
  models.Team.findOne({ where: { id: req.params.id },
                                 include: [ 'creator',
                                          { model: models.Agent, as: 'members' },
                                           'organization'] }).then(team => {
    if (!team) {
      return res.status(404).json( { message: 'No such team' });
    }

    if (req.agent.email !== team.creator.email) {
      return res.status(401).json( { message: 'Unauthorized' });
    }

    models.Agent.findOne({ where: { id: req.params.agentId } }).then(agent => {
      if (!agent || !team.members.map(member => member.id).includes(agent.id)) {
        return res.status(404).json({ message: 'That agent is not a member' });
      }

      team.removeMember(req.params.agentId).then(results => {
        let mailOptions = {
          to: agent.email,
          from: process.env.NOREPLY_EMAIL,
          subject: 'Identity membership update',
          text: `You are no longer a member of ${team.name}`
        };
        mailer.transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Mailer Error', error);
            return res.status(501).json(error);
          }
          res.status(201).json({ message: 'Member removed' });
        });
      }).catch(err => {
        res.status(500).json(err);
      });
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});


module.exports = router;
