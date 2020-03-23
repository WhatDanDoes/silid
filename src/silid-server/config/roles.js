/**
 * As with those set in `./permissions.js`, these roles must match those
 * configured for the API at Auth0
 */
const scope = require('./permissions');

module.exports = {
  sudo: [
    scope.create.agents, scope.read.agents, scope.update.agents, scope.delete.agents,
    scope.create.organizations, scope.read.organizations, scope.update.organizations, scope.delete.organizations,
    scope.create.organizationMembers, scope.read.organizationMembers, scope.delete.organizationMembers,
    scope.create.teams, scope.read.teams, scope.update.teams, scope.delete.teams,
    scope.create.teamMembers, scope.read.teamMembers, scope.delete.teamMembers,
  ],
  organizationManager: [
    scope.read.agents,
    scope.read.organizations, scope.update.organizations,
    scope.create.teams, scope.read.teams, scope.update.teams, scope.delete.teams,
    scope.create.organizationMembers, scope.read.organizationMembers, scope.delete.organizationMembers,
  ],
  organizationMember: [
    scope.read.agents,
    scope.read.organizations, scope.update.organizations,
    scope.create.teams, scope.read.teams, scope.update.teams, scope.delete.teams,
    scope.read.organizationMembers
  ],
  teamManager: [
    scope.read.agents,
    scope.read.teams, scope.update.teams,
    scope.create.teamMembers, scope.read.teamMembers, scope.delete.teamMembers,
  ],
  teamMember: [
    scope.read.agents,
    scope.read.teams,
    scope.read.teamMembers
  ],
};
