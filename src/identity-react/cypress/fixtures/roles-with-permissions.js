/**
 * As with those set in `./permissions.js`, these roles must match those
 * configured for the API at Auth0
 *
 * They also match `silid-server/config/roles.js`
 */
const scope = require('./permissions');

module.exports = {
  sudo: [
    scope.create.agents, scope.read.agents, scope.update.agents, scope.delete.agents,
  ],
  organizer: [
  ],
  viewer: [
    scope.read.agents, scope.update.agents,
  ],
};
