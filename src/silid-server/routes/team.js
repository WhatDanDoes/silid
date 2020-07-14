const express = require('express');
const router = express.Router();
const models = require('../models');
const mailer = require('../mailer');
const uuid = require('uuid');

const upsertUpdates = require('../lib/upsertUpdates');

/**
 * Configs must match those defined for RBAC at Auth0
 */
const scope = require('../config/permissions');
const roles = require('../config/roles');
const checkPermissions = require('../lib/checkPermissions');

const apiScope = require('../config/apiPermissions');
const getManagementClient = require('../lib/getManagementClient');

/**
 * Take agent user_metadata and collate it into manageable team data
 *
 * @param array
 * @param string
 * @param string
 * @param boolean
 *
 * @returns array
 */
function collateTeams(agents, teamId, agentId, isSuper=false) {
  let agentIndex = agents.findIndex(a => a.user_id === agentId);

  // Requesting agent is not a member of the team
  if (agentIndex < 0 && !isSuper) {
    return;
  }
  else if (agentIndex < 0 && isSuper) {
    agentIndex = 0;
  }

  const teamIndex = agents[agentIndex].user_metadata.teams.findIndex(t => t.id === teamId);
  let teams = { ...agents[agentIndex].user_metadata.teams[teamIndex], members: [] };

  agents.map(agent => {
    teams.members.push({ name: agent.name, email: agent.email, user_id: agent.user_id });
  });

  teams.members.sort((a, b) => {
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    }
    return 0;
  });

  return teams;
}

router.get('/', checkPermissions([scope.read.teams]), function(req, res, next) {
  const managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUser({id: req.user.user_id}).then(agent => {
    res.status(200).json(agent.user_metadata.teams);
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.get('/:id/:admin?', checkPermissions([scope.read.teams]), function(req, res, next) {
  const managementClient = getManagementClient(apiScope.read.usersAppMetadata);
  managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.teams.id:"${req.params.id}"` }).then(agents => {
    if (agents.length) {

      const requestedTeam = agents[0].user_metadata.teams.find(t => t.id === req.params.id);

      if (requestedTeam.organizationId) {
        // Is the requesting agent an organizer?
        let organization;
        if (req.user.user_metadata && req.user.user_metadata.organizations) {
          organization = req.user.user_metadata.organizations.find(o => o.id === requestedTeam.organizationId);
        }

        if (organization) {
          const team = collateTeams(agents, req.params.id, req.user.user_id, true);

          if (!team) {
            return res.status(403).json({ message: 'You are not a member of that team' });
          }

          return res.status(200).json({ ...team, organization });
        }
        else {
          managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.organizations.id:"${requestedTeam.organizationId}"` }).then(organizers => {
            // For now, there can only be one
            if (organizers.length) {

              let organization = organizers[0].user_metadata.organizations.find(o => o.id === requestedTeam.organizationId);

              const team = collateTeams(agents, req.params.id, req.user.user_id, (req.user.isSuper && !!req.params.admin));

              if (!team) {
                return res.status(403).json({ message: 'You are not a member of that team' });
              }

              return res.status(200).json({ ...team, organization });
            }
            res.status(200).json(team);
          }).catch(err => {
            res.status(err.statusCode).json(err.message.error_description);
          });
        }
      }
      else {
        const team = collateTeams(agents, req.params.id, req.user.user_id, req.user.isSuper && !!req.params.admin);

        if (!team) {
          return res.status(403).json({ message: 'You are not a member of that team' });
        }

        return res.status(200).json(team);
      }
    }
    else {
      res.status(404).json({ message: 'No such team' });
    }
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.post('/', checkPermissions([scope.create.teams]), function(req, res, next) {
  // Make sure incoming data is legit
  let teamName = req.body.name;
  if (teamName) {
    teamName = teamName.trim();
  }

  if (!teamName) {
    return res.status(400).json({ errors: [{ message: 'Team requires a name' }] });
  }
  else if (teamName.length > 128) {
    return res.status(400).json({ errors: [{ message: 'Team name is too long' }] });
  }

  let managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUser({id: req.user.user_id}).then(agent => {

    // No duplicate team names
    if (agent.user_metadata) {
      if (agent.user_metadata.teams) {
        let teams = agent.user_metadata.teams.map(team => team.name);
        if (teams.includes(teamName)) {
          return res.status(400).json({ errors: [{ message: 'That team is already registered' }] });
        }
      }
      else {
        agent.user_metadata.teams = [];
      }
    }
    else {
      agent.user_metadata = { teams: [] };
    }

    agent.user_metadata.teams.push({
      id: uuid.v4(),
      name: teamName,
      leader: req.user.email,
    });

    managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
    managementClient.updateUser({id: req.user.user_id}, { user_metadata: agent.user_metadata }).then(result => {
      // Auth0 does not return agent scope
      result.scope = req.user.scope;
      // 2020-4-30 https://stackoverflow.com/a/24498660/1356582
      // This updates the agent's session data
      req.login(result, err => {
        if (err) return next(err);

        res.status(201).json(result);
      });
    }).catch(err => {
      res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
  });
});

/**
 * PUT /team/:id
 *
 * Update team record
 */
router.put('/:id', checkPermissions([scope.update.teams]), function(req, res, next) {
  // Validate incoming data
  const teamName = req.body.name.trim();
  if (!teamName) {
    return res.status(400).json({ errors: [{ message: 'Team requires a name' }] });
  }

  if (!req.user.user_metadata.teams) {
    req.user.user_metadata.teams = [];
  }

  // Find the team
  let teamIndex = req.user.user_metadata.teams.findIndex(t => t.id === req.params.id);
  if (teamIndex < 0 && !req.user.isSuper) {
    return res.status(404).json({ message: 'No such team' });
  }

  // Decide permission
  if (teamIndex >= 0 && req.user.email !== req.user.user_metadata.teams[teamIndex].leader && !req.user.isSuper) {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  // Refresh team info
  let agents = [];
  let managementClient = getManagementClient([apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.teams.id:"${req.params.id}"` }).then(results => {

    if (!results.length) {
      return res.status(404).json({ message: 'No such team' });
    }

    // Find the team leader
    const leaderEmail = results[0].user_metadata.teams.find(team => team.id === req.params.id).leader;
    const teamLeader = results.find(agent => agent.email === leaderEmail);
    teamIndex = teamLeader.user_metadata.teams.findIndex(t => t.id === req.params.id);

    // Make sure edited name isn't a duplicate
    const nameCount = teamLeader.user_metadata.teams.reduce((n, team) => n + (team.name === teamName), 0);
    if (nameCount > 0) {
      return res.status(400).json({ errors: [{ message: 'That team is already registered' }] });
    }

    agents = agents.concat(results);
    const updates = [];
    agents.forEach(a => {
      if (a.email !== leaderEmail) {
        updates.push({
          uuid: req.params.id,
          type: 'team',
          recipient: a.email,
          data: {
            ...teamLeader.user_metadata.teams[teamIndex],
            name: teamName,
          }
        });
      }
    });

    // Update RSVPs
    managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.rsvps.uuid:"${req.params.id}"` }).then(results => {
      agents.concat(results);
      results.forEach(a => {
        if (a.email !== leaderEmail) {
          updates.push({
            uuid: req.params.id,
            type: 'team',
            recipient: a.email,
            data: {
              ...teamLeader.user_metadata.teams[teamIndex],
              name: teamName,
            }
          });
        }
      });

      // Update any pendingInvitations
      if (!teamLeader.user_metadata.pendingInvitations) {
        teamLeader.user_metadata.pendingInvitations = [];
      }
      const pending = teamLeader.user_metadata.pendingInvitations.filter(invite => invite.uuid === req.params.id);
      for (let p of pending) {
        p.name = teamName;
      }

      // Update team
      if (teamIndex >= 0) {
        teamLeader.user_metadata.teams[teamIndex].name = teamName;
      }

      // Update user_metadata at Auth0
      managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
      managementClient.updateUserMetadata({id: teamLeader.user_id}, teamLeader.user_metadata).then(agent => {

        // Update retrieved team membership list
        const replaceIndex = agents.findIndex(agent => agent.user_id === teamLeader.user_id);
        if (replaceIndex >= 0) {
          agents[replaceIndex] = agent;
        }

        /**
         * 2020-5-20
         * https://github.com/sequelize/sequelize/pull/11984#issuecomment-625193209
         *
         * Upserting on composite keys has yet to be released. When it is, this
         * step can be simplified as follows (or similar)...
         */
        //  models.Update.bulkCreate(updates, { updateOnDuplicate: ['name', 'updatedAt'], upsertKeys: { fields: ['uuid', 'recipient'] } }).then(result => {
        //    const teams = collateTeams(agents, req.params.id, req.user.user_id);
        //    res.status(201).json(teams);
        //  }).catch(err => {
        //    res.status(500).json(err);
        //  });

        models.Update.update({ data: {...teamLeader.user_metadata.teams[teamIndex], name: teamName} }, { where: {uuid: req.params.id} }).then(results => {

          upsertUpdates(updates, err => {
            if (err) {
              return res.status(500).json(err);
            }
            const teams = collateTeams(agents, req.params.id, teamLeader.user_id, req.user.isSuper);
            res.status(201).json(teams);
          });
        }).catch(err => {
          res.status(500).json(err);
        });

      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });
    }).catch(err => {
      res.status(err.statusCode).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.delete('/:id', checkPermissions([scope.delete.teams]), function(req, res, next) {
  let managementClient = getManagementClient([apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.teams.id:"${req.params.id}"` }).then(agents => {
    if (!agents.length) {
      return res.status(404).json({ message: 'No such team' });
    }
    else if (agents.length > 1) {
      return res.status(200).json({ message: 'Team still has members. Cannot delete' });
    }

    // There should only ever be one agent given the application of UUIDs
    // Is this true?
    let teamIndex = 0;
    for (let agent of agents) {
      for (let team of agent.user_metadata.teams) {
        if (team.id === req.params.id) {
          break;
        }
        teamIndex++;
      }
      if (teamIndex === agent.user_metadata.teams.length) {
        return res.status(404).json({ message: 'No such team' });
      }

      if (!req.user.isSuper && req.user.email !== agent.user_metadata.teams[teamIndex].leader) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      agent.user_metadata.teams.splice(teamIndex, 1);
      managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
      managementClient.updateUserMetadata({id: agent.user_id}, agent.user_metadata).then(agent => {
        res.status(201).json({ message: 'Team deleted', agent: agent });
      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });
    }
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

/**
 * Send email invitation to join a team
 */
function inviteAgent(invite, req, res) {
  const mailOptions = {
    from: process.env.NOREPLY_EMAIL,
    to: invite.recipient,
    subject: 'Identity team invitation',
    text: `
      You have been invited to join a team:

      ${invite.data.name}

      Login at the link below to view the invitation:

      ${process.env.SERVER_DOMAIN}
    `
  };

  mailer.transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Mailer Error', error);
      return res.status(501).json(error);
    }

    res.status(201).json(req.user);
  });
}

/**
 * Manage Updates for agents unknown to Auth0
 */
function createUpdate(req, res, recipientEmail, update) {
  models.Update.findOne({ where: { uuid: req.params.id, recipient: recipientEmail } }).then(result => {
    if (!result) {
      models.Update.upsert(update).then(results => {

        if (!req.user.user_metadata.pendingInvitations) {
          req.user.user_metadata.pendingInvitations = [];
        }
        req.user.user_metadata.pendingInvitations.push(update);

        const managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
        managementClient.updateUser({id: req.user.user_id}, { user_metadata: req.user.user_metadata }).then(result => {
          inviteAgent(update, req, res);
        }).catch(err => {
          res.status(500).json(err);
        });

      }).catch(err => {
        res.status(500).json(err);
      });
    }
    else {
      // 2020-5-7 Force updating the timestamp - https://github.com/sequelize/sequelize/issues/3759
      result.changed('updatedAt', true);
      result.save().then(result => {
        inviteAgent(result, req, res);
      }).catch(err => {
        res.status(500).json(err);
      });
    }
  }).catch(err => {
    res.status(500).json(err);
  });
};

router.put('/:id/agent', checkPermissions([scope.create.teamMembers]), function(req, res, next) {
  if (!req.body.email) {
    return res.status(400).json({ message: 'No email provided' });
  }

  let team;
  if (req.user.user_metadata.teams) {
    team = req.user.user_metadata.teams.find(team => team.id === req.params.id);
  }

  let managementClient;
  if (!team) {
    if (!req.user.user_metadata.pendingInvitations) {
      req.user.user_metadata.pendingInvitations = [];
    }
    let inviteIndex = req.user.user_metadata.pendingInvitations.findIndex(i => i.uuid === req.params.id && i.type === 'team' && i.recipient === req.body.email);
    if (inviteIndex < 0) {
      return res.status(404).json({ message: 'No such team' });
    }
    req.user.user_metadata.pendingInvitations.splice(inviteIndex, 1);

    managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
    managementClient.updateUser({id: req.user.user_id}, { user_metadata: req.user.user_metadata }).then(result => {
      req.user = {...req.user, ...result};
      res.status(404).json(req.user);
    }).catch(err => {
      res.status(500).json(err);
    });
  }
  else {
    let recipientEmail = req.body.email.trim().toLowerCase();

    // Make sure agent isn't already a member of the team
    models.Agent.findOne({ where: { email: recipientEmail } }).then(agent => {
      const invite = { uuid: req.params.id, recipient: recipientEmail, type: 'team', data: {name: team.name, id: req.params.id, leader: team.leader, organizationId: team.organizationId, } };

      if (agent) {
        managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata].join(' '));
        managementClient.getUser({id: agent.socialProfile.user_id}).then(invitedAgent => {

          if (!invitedAgent.user_metadata) {
            invitedAgent.user_metadata = { teams: [], rsvps: [] };
          }
          else if (!invitedAgent.user_metadata.rsvps) {
            invitedAgent.user_metadata.rsvps = [];
          }

          let isMember;
          if (invitedAgent.user_metadata.teams) {
            isMember = invitedAgent.user_metadata.teams.find(team => team.id === req.params.id);
          }

          if (isMember) {
            return res.status(200).json({ message: `${agent.email} is already a member of this team` });
          }

          // Check if this agent already has an invitation (functionality covered by client-side tests, because globally modified `const` profiles are just too hairy)
          const existingInvite = invitedAgent.user_metadata.rsvps.find(rsvp => rsvp.uuid === req.params.id && rsvp.type === 'team' && rsvp.recipient === invitedAgent.email);
          if (existingInvite) {
            return inviteAgent(invite, req, res);
          }

          invitedAgent.user_metadata.rsvps.push(invite);
          managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
          managementClient.updateUser({id: invitedAgent.user_id}, { user_metadata: invitedAgent.user_metadata }).then(result => {

            // Write invite to team leader's pendingInvitations
            if (!req.user.user_metadata.pendingInvitations) {
              req.user.user_metadata.pendingInvitations = [];
            }
            req.user.user_metadata.pendingInvitations.push(invite);

            // 2020-5-12 Interesting... if you don't get a new client, it recycles the OAuth token
            // This is probably totally unnecessary
            managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
            managementClient.updateUser({id: req.user.user_id}, { user_metadata: req.user.user_metadata }).then(result => {

              req.user = {...req.user, ...result};
              inviteAgent(invite, req, res);

            }).catch(err => {
              res.status(500).json(err);
            });
          }).catch(err => {
            res.status(500).json(err);
          });
        }).catch(err => {
          // This comes into play if agent is manually deleted at Auth0
          if (err.statusCode === 404) {
            return createUpdate(req, res, recipientEmail, invite);
          }
          res.status(500).json(err);
        });
      }
      else {
        createUpdate(req, res, recipientEmail, invite);
      }
    }).catch(err => {
      res.status(500).json(err);
    });
  }
});

/**
 * Accept or reject team invitation
 */
router.get('/:id/invite/:action', checkPermissions([scope.create.teamMembers]), function(req, res, next) {
  const rsvpIndex = req.user.user_metadata.rsvps.findIndex(rsvp => rsvp.uuid === req.params.id);
  if (rsvpIndex < 0) {
    return res.status(404).json({ message: 'No such invitation' });
  }
  const managementClient = getManagementClient(apiScope.read.usersAppMetadata);
  managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.pendingInvitations.uuid:"${req.params.id}"` }).then(agents => {

    /**
     * Can there (or will there ever) be more than one agent in this scenario?
     */
    if (agents.length) {
      let inviteIndex;
      const teamLeader = agents.find(a => {
        if (a.user_metadata && a.user_metadata.pendingInvitations) {
          inviteIndex = a.user_metadata.pendingInvitations.findIndex(i => i.uuid === req.params.id && i.type === 'team' && i.recipient === req.user.email);
          return inviteIndex > -1;
        }
        return false;
      });

      if (!teamLeader) {
        return res.status(404).json({ message: 'No such invitation' });
      }

      if (!req.user.user_metadata.teams) {
        req.user.user_metadata.teams = [];
      }

      if (req.params.action === 'accept') {
        let team = teamLeader.user_metadata.teams.find(t => t.id === req.params.id)
        req.user.user_metadata.teams.push(team);

      }
      else if (req.params.action !== 'reject') {
        return res.status(404).send();
      }

      req.user.user_metadata.rsvps.splice(rsvpIndex, 1);
      teamLeader.user_metadata.pendingInvitations.splice(inviteIndex, 1);

      managementClient.updateUser({id: req.user.user_id}, { user_metadata: req.user.user_metadata }).then(result => {
        managementClient.updateUser({id: teamLeader.user_id}, { user_metadata: teamLeader.user_metadata }).then(result => {
          res.status(201).json(req.user);
        }).catch(err => {
          res.status(err.statusCode).json(err.message.error_description);
        });
      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });
    }
    else {
      req.user.user_metadata.rsvps.splice(rsvpIndex, 1);
      managementClient.updateUser({id: req.user.user_id}, { user_metadata: req.user.user_metadata }).then(result => {
        res.status(404).json(result);
      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });
    }
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});


/**
 * Delete pending team invitation
 */
router.delete('/:id/invite', checkPermissions([scope.delete.teamMembers]), function(req, res, next) {
  const inviteIndex = req.user.user_metadata.pendingInvitations.findIndex(invite =>
                                                                          invite.uuid === req.params.id && invite.type === 'team' && invite.recipient === req.body.email);
  if (inviteIndex < 0) {
    return res.status(404).json({ message: 'No such invitation' });
  }

  // Returns `0` if nothing was removed
  models.Update.destroy({ where: { uuid: req.params.id, recipient: req.body.email } }).then(deleted => {

    req.user.user_metadata.pendingInvitations.splice(inviteIndex, 1);

    let managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
    managementClient.updateUser({id: req.user.user_id}, { user_metadata: req.user.user_metadata }).then(result => {

      // A known agent, so he needs to be updated at Auth0
      if (!deleted) {
        models.Agent.findOne({ where: { email: req.body.email.trim().toLowerCase() } }).then(invitedAgent => {

          if (invitedAgent) {
            managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata].join(' '));
            managementClient.getUser({id: invitedAgent.socialProfile.user_id}).then(a => {
              const rsvpIndex = a.user_metadata.rsvps.findIndex(r => r.uuid === req.params.id);
              a.user_metadata.rsvps.splice(rsvpIndex, 1);

              managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
              managementClient.updateUser({id: a.user_id}, { user_metadata: a.user_metadata }).then(result => {
                res.status(201).json(req.user);
              }).catch(err => {
                res.status(err.statusCode).json(err.message.error_description);
              });
            }).catch(err => {
              res.status(err.statusCode).json(err.message.error_description);
            });
          }
          else {
            res.status(404).json(req.user);
          }
        }).catch(err => {
          res.status(500).json(err);
        });

      }
      else {
        res.status(201).json(req.user);
      }
    }).catch(err => {
      res.status(err.statusCode).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});


router.delete('/:id/agent/:agentId', checkPermissions([scope.delete.teamMembers]), function(req, res, next) {

  let team;
  if (!req.user.isSuper) {
    if (!req.user.user_metadata || !req.user.user_metadata.teams) {
      return res.status(404).json({ message: 'No such team' });
    }

    team = req.user.user_metadata.teams.find(t => t.id === req.params.id);

    if (!team) {
      return res.status(404).json({ message: 'No such team' });
    }

    if (req.user.email !== team.leader) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (req.user.user_id === req.params.agentId) {
      return res.status(403).json({ message: 'Team leader cannot be removed from team' });
    }
  }

  let managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUser({id: req.params.agentId}).then(invitedAgent => {

    if (!invitedAgent) {
      return res.status(404).json( { message: 'That agent is not a member' });
    }

    const teamIndex = invitedAgent.user_metadata.teams.findIndex(t => t.id === req.params.id);
    if (teamIndex < 0) {
      return res.status(404).json({ message: 'No such team' });
    }
    team = invitedAgent.user_metadata.teams.splice(teamIndex, 1)[0];

    if (invitedAgent.email === team.leader) {
      return res.status(403).json({ message: 'Team leader cannot be removed from team' });
    }

    managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
    managementClient.updateUser({id: invitedAgent.user_id}, { user_metadata: invitedAgent.user_metadata }).then(result => {

      let mailOptions = {
        to: invitedAgent.email,
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
    if (err.statusCode === 404) {
      return res.status(err.statusCode).json({ message: 'That agent is not a member' });
    }
    res.status(err.statusCode).json(err);
  });
});


module.exports = router;
