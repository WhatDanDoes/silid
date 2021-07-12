/**
 * These permissions must match those configured for the API at Auth0.
 *
 * They also match `silid-server/config/permissions.js`
 */
module.exports = {
 // Create
  create: {
    agents: 'create:agents',
  },
  // Read
  read: {
    agents: 'read:agents',
  },
  // Update
  update: {
    agents: 'update:agents',
  },
  // Delete
  'delete': {
    agents: 'delete:agents',
  }
}

