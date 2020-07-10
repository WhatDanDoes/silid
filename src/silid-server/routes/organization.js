const express = require('express');
const router = express.Router();
const models = require('../models');
const mailer = require('../mailer');
const uuid = require('uuid');

const upsertInvites = require('../lib/upsertInvites');

/**
 * Configs must match those defined for RBAC at Auth0
 */
const scope = require('../config/permissions');
const roles = require('../config/roles');
const checkPermissions = require('../lib/checkPermissions');

const apiScope = require('../config/apiPermissions');
const getManagementClient = require('../lib/getManagementClient');

/* GET organization listing. */
router.get('/admin', checkPermissions(roles.sudo), function(req, res, next) {
  if (!req.user.isSuper) {
    return res.status(403).json( { message: 'Forbidden' });
  }

  // Super agent gets entire listing
  models.Organization.findAll().then(orgs => {
    res.json(orgs);
  }).catch(err => {
    res.status(500).json(err);
  });
});


router.get('/', checkPermissions([scope.read.organizations]), function(req, res, next) {
  const managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUser({id: req.user.user_id}).then(agent => {

    if (agent.user_metadata && agent.user_metadata.organizations) {
      const orgs = agent.user_metadata.organizations.sort((a, b) => {
        if (a.name < b.name) {
          return -1;
        }
        if (a.name > b.name) {
          return 1;
        }
        return 0;
      });

      return res.status(200).json(orgs);
    }
    res.status(404).json([]);
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

/**
 * Consolidates an organization's member teams
 *
 * @param array
 * @param object
 * @param string
 */
function consolidateTeams(agents, org, id) {
  // Get all the teams belonging to this organization
  let teamIds = [];
  let teams = [];
  for (let agent of agents) {
    let t = agent.user_metadata.teams.filter(team => {
      if (team.organizationId === id && teamIds.indexOf(team.id) < 0) {
        teamIds.push(team.id);
        return true;
      }
      return false;
    });
    teams = teams.concat(t);
  }
  // Sort teams alphabetically by team name
  teams.sort((a, b) => {
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    }
    return 0;
  });

  org.teams = teams;
  return org;
}

router.get('/:id', checkPermissions([scope.read.organizations]), function(req, res, next) {
  const managementClient = getManagementClient(apiScope.read.usersAppMetadata);
  managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.organizations.id:"${req.params.id}"` }).then(organizers => {
    if (organizers.length) {

      // Get the organization
      const organization = organizers[0].user_metadata.organizations.find(org => org.id === req.params.id);

      managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.teams.organizationId:"${req.params.id}"` }).then(agents => {

        // Is this agent allowed to view this organization?
        let isAffiliate = true;
        if (organization.organizer !== req.user.email) {
          isAffiliate = agents.some(a => a.email === req.user.email);
        }

        if (isAffiliate || req.user.isSuper) {
          // Get all the teams belonging to this organization
          consolidateTeams(agents, organization, req.params.id)

          return res.status(200).json(organization);
        }
        else {
          return res.status(403).json({ message: 'You are not a member of that organization' });
        }
      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });
    }
    else {
      res.status(404).json({ message: 'No such organization' });
    }
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.post('/', checkPermissions([scope.create.organizations]), function(req, res, next) {
  // Make sure incoming data is legit
  let orgName = req.body.name;
  if (orgName) {
    orgName = orgName.trim();
  }

  if (!orgName) {
    return res.status(400).json({ errors: [{ message: 'Organization requires a name' }] });
  }
  else if (orgName.length > 128) {
    return res.status(400).json({ errors: [{ message: 'Organization name is too long' }] });
  }

  let managementClient = getManagementClient([apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.organizations.name:"${orgName}"` }).then(organizers => {

    if (organizers.length) {
      return res.status(400).json({ errors: [{ message: 'That organization is already registered' }] });
    }

    managementClient.getUser({id: req.user.user_id}).then(agent => {

      // No duplicate team names
      if (agent.user_metadata) {
        if (agent.user_metadata.organizations) {
          let organizations = agent.user_metadata.organizations.map(org => org.name);
          if (organizations.includes(orgName)) {
            return res.status(400).json({ errors: [{ message: 'That organization is already registered' }] });
          }
        }
        else {
          agent.user_metadata.organizations = [];
        }
      }
      else {
        agent.user_metadata = { organizations: [] };
      }

      agent.user_metadata.organizations.push({
        id: uuid.v4(),
        name: orgName,
        organizer: req.user.email,
      });

      managementClient.updateUser({id: req.user.user_id}, { user_metadata: agent.user_metadata }).then(result => {
        // Auth0 does not return agent scope
        result.scope = req.user.scope;
        result.roles = req.user.roles;
        // 2020-4-30 https://stackoverflow.com/a/24498660/1356582
        // This updates the agent's session data
        req.login(result, err => {
          if (err) return next(err);

          res.status(201).json({...result, roles: req.user.roles});
        });
      }).catch(err => {
        res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
      });
    }).catch(err => {
      res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
  });
});

router.put('/:id', checkPermissions([scope.update.organizations]), function(req, res, next) {
  // Make sure incoming data is legit
  let orgName = req.body.name;
  if (orgName) {
    orgName = orgName.trim();
  }

  if (!orgName) {
    return res.status(400).json({ errors: [{ message: 'Organization requires a name' }] });
  }
  else if (orgName.length > 128) {
    return res.status(400).json({ errors: [{ message: 'Organization name is too long' }] });
  }

  let managementClient = getManagementClient([apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.organizations.name:"${orgName}"` }).then(organizers => {

    if (organizers.length) {
      return res.status(400).json({ errors: [{ message: 'That organization is already registered' }] });
    }

    managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.organizations.id:"${req.params.id}"` }).then(organizers => {

      if (organizers.length) {

        // Anticipating multiple organizers... right now, there should only be one per organization
        let organizerIndex = organizers.findIndex(o => o.email === req.user.email);
        if (organizerIndex < 0 && !req.user.isSuper) {
          return res.status(403).json({ message: 'You are not an organizer' });
        }
        else {
          organizerIndex = 0;
        }

        // Find the organization to be updated
        const orgIndex = organizers[organizerIndex].user_metadata.organizations.findIndex(org => org.id === req.params.id);

        // Update organization
        organizers[organizerIndex].user_metadata.organizations[orgIndex].name = orgName;

        // Update pending invitations
        if (!organizers[organizerIndex].user_metadata.pendingInvitations) {
          organizers[organizerIndex].user_metadata.pendingInvitations = [];
        }
        const pending = organizers[organizerIndex].user_metadata.pendingInvitations.filter(invite => invite.uuid === req.params.id);
        for (let p of pending) {
          p.name = orgName;
        }

        // Update the organizer's metadata
        managementClient.updateUser({id: organizers[organizerIndex].user_id}, { user_metadata: organizers[organizerIndex].user_metadata }).then(result => {

          // Update waiting invites
          models.Invitation.update({ name: orgName }, { where: {uuid: req.params.id} }).then(results => {

            // Retrieve and consolidate organization info
            managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.teams.organizationId:"${req.params.id}"` }).then(agents => {
              let organization = consolidateTeams(agents, organizers[organizerIndex].user_metadata.organizations[orgIndex], req.params.id)

              // Retrieve outstanding RSVPs
              managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.rsvps.uuid:"${req.params.id}"` }).then(results => {
                const invitations = [];
                results.forEach(a => {
                  // Get agent's team ID
                  let i = a.user_metadata.rsvps.find(r => r.uuid === req.params.id);
                  invitations.push({ uuid: req.params.id, type: 'organization', name: orgName, recipient: a.email, teamId: i.teamId });
                });

                upsertInvites(invitations, err => {
                  if (err) {
                    return res.status(500).json(err);
                  }
                  res.status(201).json(organization);
                });
              }).catch(err => {
                res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
              });
            }).catch(err => {
              res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
            });
          }).catch(err => {
            res.status(500).json(err);
          });
        }).catch(err => {
          res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
        });
      }
      else {
        res.status(404).json({ message: 'No such organization' });
      }
    }).catch(err => {
      res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
  });
});

router.delete('/:id', checkPermissions([scope.delete.organizations]), function(req, res, next) {
  let managementClient = getManagementClient([apiScope.read.usersAppMetadata].join(' '));

  // Check for member teams
  managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.teams.organizationId:"${req.params.id}"` }).then(teams => {
    if (teams.length){
      return res.status(400).json({ message: 'Organization has member teams. Cannot delete' });
    }

    // Get organizer
    managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.organizations.id:"${req.params.id}"` }).then(organizers => {

      // For the moment, there is only one organizer
      if (organizers.length) {
        if (organizers[0].email !== req.user.email && !req.user.isSuper) {
          return res.status(403).json({ message: 'You are not the organizer' });
        }

        if (organizers[0].user_metadata && organizers[0].user_metadata.pendingInvitations) {
          const invite = organizers[0].user_metadata.pendingInvitations.find(i => i.uuid === req.params.id);
          if (invite) {
            return res.status(400).json({ message: 'Organization has invitations pending. Cannot delete' });
          }
        }

        // Find the organization
        const orgIndex = organizers[0].user_metadata.organizations.findIndex(o => o.id === req.params.id);
        organizers[0].user_metadata.organizations.splice(orgIndex, 1);

        // Update the organizer's metadata
        managementClient.updateUser({id: organizers[0].user_id}, { user_metadata: organizers[0].user_metadata }).then(result => {
          res.status(201).json({ message: 'Organization deleted', organizerId: organizers[0].user_id });
        }).catch(err => {
          res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
        });
      }
      else {
        res.status(404).json({ message: 'No such organization' });
      }
    }).catch(err => {
      res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
  });
});

router.put('/:id/team', checkPermissions([scope.create.organizationMembers]), function(req, res, next) {
  if (!req.body.teamId || !req.body.teamId.trim()) {
    return res.status(400).json({ message: 'No team provided' });
  }

  let organization;
  if (req.user.user_metadata.organizations) {
    organization = req.user.user_metadata.organizations.find(o => o.id === req.params.id);
  }

  if (!organization) {
    return res.status(404).json({ message: 'No such organization' });
  }

  let managementClient = getManagementClient([apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.teams.id:"${req.body.teamId}"` }).then(agents => {

    if (!agents.length) {
      return res.status(404).json({ message: 'No such team' });
    }

    // Find the team leader
    let leader, teamIndex;
    for (agent of agents) {
      teamIndex = agent.user_metadata.teams.findIndex(team => team.leader === agent.email && team.id === req.body.teamId);
      if (teamIndex > -1) {
        leader = agent;
        break;
      }
    }

    if (leader.user_metadata.teams[teamIndex].organizationId) {
      if (leader.user_metadata.teams[teamIndex].organizationId === req.params.id) {
        return res.status(200).json({ message: 'That team is already a member of the organization' });
      }
      return res.status(200).json({ message: 'That team is already a member of another organization' });
    }

    // Add organizationId to team record
    leader.user_metadata.teams[teamIndex].organizationId = req.params.id;

    // Prepare invitations to update team members
    let invitations = [];
    agents.forEach(agent => {
      if (agent.email !== leader.email) {
        invitations.push({ uuid: req.params.id, type: 'organization', name: organization.name, recipient: agent.email, teamId: req.body.teamId });
      }
    });

    managementClient.updateUser({id: leader.user_id}, { user_metadata: leader.user_metadata }).then(result => {

      upsertInvites(invitations, err => {
        if (err) {
          return res.status(500).json(err);
        }

        organization = consolidateTeams(agents, organization, req.params.id)

        res.status(201).json(organization);
      });
    }).catch(err => {
      res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
  });
});


router.delete('/:id/agent/:agentId', checkPermissions([scope.delete.organizationMembers]), function(req, res, next) {
  models.Organization.findOne({ where: { id: req.params.id },
                                include: [ 'creator',
                                           { model: models.Agent, as: 'members' },
                                           'teams'] }).then(organization => {
    if (!organization) {
      return res.status(404).json( { message: 'No such organization' });
    }

    if (!req.user.isSuper && req.user.email !== organization.creator.email) {
      return res.status(401).json( { message: 'Unauthorized' });
    }

    models.Agent.findOne({ where: { id: req.params.agentId } }).then(agent => {
      if (!agent || !organization.members.map(member => member.id).includes(agent.id)) {
        return res.status(404).json({ message: 'That agent is not a member' });
      }

      organization.removeMember(req.params.agentId).then(results => {
        let mailOptions = {
          to: agent.email,
          from: process.env.NOREPLY_EMAIL,
          subject: 'Identity membership update',
          text: `You are no longer a member of ${organization.name}`
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
