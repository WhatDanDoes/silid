context('root/Team delete', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Teams" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "organization_team" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "TeamMembers" CASCADE;');
  });

  describe('Deleting', () => {

    let root, regularAgent, organization, team;
    beforeEach(function() {
      // Login/create regular agent
      cy.login('regularguy@example.com', _profile, [this.scope.read.agents, this.scope.create.organizations]);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        regularAgent = results[0];
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'National Lacrosse League' } }).then((org) => {
          organization = org.body;

          cy.login(_profile.email, _profile);
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
          });
        });
      });
    });

    describe('root\'s own team', () => {

      describe('when an organization member', () => {
        beforeEach(function() {
          cy.login(regularAgent.email, _profile, [this.scope.read.agents, this.scope.update.organizations]);

          // Add root as member
          cy.request({ url: '/organization', method: 'PATCH', body: { id: organization.id, memberId: root.id } }).then((res) => {

            // Verify root membership
            cy.task('query', `UPDATE "OrganizationMembers" SET "verificationCode"=null WHERE "AgentId"=${root.id};`).then(([results, metadata]) => {

              // Login root and create team
              cy.login(root.email, _profile);
              cy.request({ url: '/team',  method: 'POST',
                           body: { organizationId: organization.id, name: 'The Calgary Roughnecks' } }).then(res => {
                team = res.body;
              });
            });
          });
        });

        describe('admin mode', () => {
          context('switched on', () => {
            context('member agents exist', () => {
              beforeEach(function() {
                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: regularAgent.email } }).then((res) => {
                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.contains('Team Directory').click();
                  cy.wait(500);
                  cy.contains(team.name).click();
                  cy.wait(500);
                  cy.get('button#edit-team').click();
                });
              });

              it('does not allow deletion', function(done) {
                cy.on('window:alert', (str) => {
                  expect(str).to.eq('Remove all team members before deleting the team');
                  done();
                });
                cy.get('button#delete-team').click();
              });
            });

            context('no team members exist', () => {
              beforeEach(() => {
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].AgentId).to.eq(root.id);

                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.contains('Team Directory').click();
                  cy.wait(500);
                  cy.contains(team.name).click();
                  cy.wait(500);
                  cy.get('button#edit-team').click();
                });
              });

              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Delete team?');
                  done();
                });
                cy.get('button#delete-team').click();
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('button#delete-team').click();
                cy.url().should('contain', `/#/organization/${organization.id}`);
              });

              it('removes record from the database', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  cy.get('button#delete-team').click().then(() => {
                    cy.wait(500);
                    cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                      expect(results.length).to.eq(0);
                    });
                  });
                });
              });

              it('renders the interface correctly on completion with success message', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('button#delete-team').click();
                cy.wait(500);
                cy.get('#team-list').should('not.exist');
                cy.contains('Team deleted');
              });
            });
          });

          context('switched off', () => {
            beforeEach(() => {
              // Root login
              cy.login(root.email, _profile);
            });

            context('member agents exist', () => {
              beforeEach(function() {
                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: regularAgent.email } }).then((res) => {
                  cy.get('#app-menu-button').click();
                  cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
                  cy.get('#organization-button').click();
                  cy.wait(500);
                  cy.contains(organization.name).click();
                  cy.wait(500);
                  cy.contains(team.name).click();
                  cy.wait(500);
                  cy.get('button#edit-team').click();
                });
              });

              it('does not allow deletion', function(done) {
                cy.on('window:alert', (str) => {
                  expect(str).to.eq('Remove all team members before deleting the team');
                  done();
                });
                cy.get('button#delete-team').click();
              });
            });

            context('no team members exist', () => {
              beforeEach(() => {
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].AgentId).to.eq(root.id);

                  cy.get('#app-menu-button').click();
                  cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
                  cy.get('#organization-button').click();
                  cy.wait(500);
                  cy.contains(organization.name).click();
                  cy.wait(500);
                  cy.contains(team.name).click();
                  cy.wait(500);
                  cy.get('button#edit-team').click();
                });
              });

              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Delete team?');
                  done();
                });
                cy.get('button#delete-team').click();
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('button#delete-team').click();
                cy.url().should('contain', `/#/organization/${organization.id}`);
              });

              it('removes record from the database', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  cy.get('button#delete-team').click().then(() => {
                    cy.wait(500);
                    cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                      expect(results.length).to.eq(0);
                    });
                  });
                });
              });

              it('renders the interface correctly on completion with success message', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('button#delete-team').click();
                cy.wait(500);
                cy.get('#team-list').should('not.exist');
                cy.contains('Team deleted');
              });
            });
          });
        });
      });

      describe('when not an organization member', () => {
        beforeEach(function() {
          // Login root and create team
          cy.login(root.email, _profile);
          cy.request({ url: '/team',  method: 'POST',
                       body: { organizationId: organization.id, name: 'The Calgary Roughnecks' } }).then(res => {
            team = res.body;
          });
        });

        describe('admin mode', () => {
          context('switched on', () => {
            context('member agents exist', () => {
              beforeEach(function() {
                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: regularAgent.email } }).then((res) => {
                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.contains('Team Directory').click();
                  cy.wait(500);
                  cy.contains(team.name).click();
                  cy.wait(500);
                  cy.get('button#edit-team').click();
                });
              });

              it('does not allow deletion', function(done) {
                cy.on('window:alert', (str) => {
                  expect(str).to.eq('Remove all team members before deleting the team');
                  done();
                });
                cy.get('button#delete-team').click();
              });
            });

            context('no team members exist', () => {
              beforeEach(() => {
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].AgentId).to.eq(root.id);

                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.contains('Team Directory').click();
                  cy.wait(500);
                  cy.contains(team.name).click();
                  cy.wait(500);
                  cy.get('button#edit-team').click();
                });
              });

              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Delete team?');
                  done();
                });
                cy.get('button#delete-team').click();
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('button#delete-team').click();
                cy.url().should('contain', `/#/organization/${organization.id}`);
              });

              it('removes record from the database', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  cy.get('button#delete-team').click().then(() => {
                    cy.wait(500);
                    cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                      expect(results.length).to.eq(0);
                    });
                  });
                });
              });

              it('renders the interface correctly on completion with success message', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('button#delete-team').click();
                cy.wait(500);
                cy.get('#team-list').should('not.exist');
                cy.contains('Team deleted');
              });
            });
          });

          context('switched off', () => {
            context('no team members exist', () => {
              beforeEach(() => {
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].AgentId).to.eq(root.id);

                  cy.get('#app-menu-button').click();
                  cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
                  cy.get('#organization-button').click();
                  cy.contains(organization.name).should('not.exist');
                  cy.visit(`/#/team/${team.id}`);
                  cy.wait(500);
                  cy.get('button#edit-team').click();
                });
              });

              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Delete team?');
                  done();
                });
                cy.get('button#delete-team').click();
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('button#delete-team').click();
                cy.url().should('contain', `/#/organization/${organization.id}`);
              });

              it('removes record from the database', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  cy.get('button#delete-team').click().then(() => {
                    cy.wait(500);
                    cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                      expect(results.length).to.eq(0);
                    });
                  });
                });
              });

              it('renders the interface correctly on completion with success message', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('button#delete-team').click();
                cy.wait(500);
                cy.get('#team-list').should('not.exist');
                cy.contains('Team deleted');
              });
            });
          });
        });
      })
    });

    describe('team created by a regular agent', () => {
      describe('when root is an organization member', () => {
        beforeEach(function() {
          cy.login(regularAgent.email, _profile, [this.scope.read.agents, this.scope.update.organizations, this.scope.create.teams, this.scope.create.organizationMembers]);

          // Add root as member
          cy.request({ url: '/organization', method: 'PATCH', body: { id: organization.id, memberId: root.id } }).then((res) => {

            // Verify root membership
            cy.task('query', `UPDATE "OrganizationMembers" SET "verificationCode"=null WHERE "AgentId"=${root.id};`).then(([results, metadata]) => {

              // Create team
              cy.request({ url: '/team',  method: 'POST',
                           body: { organizationId: organization.id, name: 'The Calgary Roughnecks' } }).then(res => {
                team = res.body;

                // Login root
                cy.login(root.email, _profile);
              });
            });
          });
        });

        describe('admin mode', () => {
          context('switched on', () => {
            context('member agents exist', () => {
              beforeEach(function() {
                // Logged in as regular agent. Add root as member
                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: root.email } }).then((res) => {

                  // Root login
                  cy.login(root.email, _profile);

                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.contains('Team Directory').click();
                  cy.wait(500);
                  cy.contains(team.name).click();
                  cy.wait(500);
                  cy.get('button#edit-team').click();
                });
              });

              it('does not allow deletion', function(done) {
                cy.on('window:alert', (str) => {
                  expect(str).to.eq('Remove all team members before deleting the team');
                  done();
                });
                cy.get('button#delete-team').click();
              });
            });

            context('no member agents exist', () => {
              beforeEach(() => {
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].AgentId).to.eq(regularAgent.id);

                  // Root login
                  cy.login(root.email, _profile);

                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.contains('Team Directory').click();
                  cy.wait(500);
                  cy.contains(team.name).click();
                  cy.wait(500);
                  cy.get('button#edit-team').click();
                });
              });

              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Delete team?');
                  done();
                });
                cy.get('button#delete-team').click();
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('button#delete-team').click();
                cy.url().should('contain', `/#/organization/${organization.id}`);
              });

              it('removes record from the database', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  cy.get('button#delete-team').click().then(() => {
                    cy.wait(500);
                    cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                      expect(results.length).to.eq(0);
                    });
                  });
                });
              });

              it('renders the interface correctly on completion with success message', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('button#delete-team').click();
                cy.wait(500);
                cy.get('#team-list').should('not.exist');
                cy.contains('Team deleted');
              });
            });
          });

          context('switched off', () => {
            context('member agents exist', () => {
              beforeEach(function() {
                // Logged in as regular agent. Add root as member
                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: root.email } }).then((res) => {

                  // Root login
                  cy.login(root.email, _profile);

                  cy.get('#app-menu-button').click();
                  cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
                  cy.get('#organization-button').click();
                  cy.wait(500);
                  cy.contains(organization.name).click();
                  cy.wait(500);
                  cy.contains(team.name).click();
                  cy.wait(500);
                });
              });

              it('renders the interface for regular team member', () => {
                cy.get('button#edit-team').should('not.exist');
                cy.get('button#delete-team').should('not.exist');
              });
            });

            context('no member agents exist', () => {
              beforeEach(() => {
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].AgentId).to.eq(regularAgent.id);

                  // Root login
                  cy.login(root.email, _profile);

                  cy.get('#app-menu-button').click();
                  cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
                  cy.get('#organization-button').click();
                  cy.wait(500);
                  cy.contains(organization.name).click();
                  cy.wait(500);
                  cy.contains(team.name).click();
                  cy.wait(500);
                });
              });

              it('renders the interface for regular team member', () => {
                cy.get('button#edit-team').should('not.exist');
                cy.get('button#delete-team').should('not.exist');
              });
            });
          });
        });
      });

      describe('when root is not an organization member', () => {
        beforeEach(function() {
          cy.login(regularAgent.email, _profile, [this.scope.read.agents,this.scope.create.teams]);

          // Create team
          cy.request({ url: '/team',  method: 'POST',
                       body: { organizationId: organization.id, name: 'The Calgary Roughnecks' } }).then(res => {
            team = res.body;

            // Login root
            cy.login(root.email, _profile);
          });
        });

        describe('admin mode', () => {
          context('switched on', () => {
            context('member agents exist', () => {
              beforeEach(function() {
                // Logged in as regular agent. Add root as member
                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: root.email } }).then((res) => {

                  // Root login
                  cy.login(root.email, _profile);

                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.contains('Team Directory').click();
                  cy.wait(500);
                  cy.contains(team.name).click();
                  cy.wait(500);
                  cy.get('button#edit-team').click();
                });
              });

              it('does not allow deletion', function(done) {
                cy.on('window:alert', (str) => {
                  expect(str).to.eq('Remove all team members before deleting the team');
                  done();
                });
                cy.get('button#delete-team').click();
              });
            });

            context('no member agents exist', () => {
              beforeEach(() => {
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].AgentId).to.eq(regularAgent.id);

                  // Root login
                  cy.login(root.email, _profile);

                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.contains('Team Directory').click();
                  cy.wait(500);
                  cy.contains(team.name).click();
                  cy.wait(500);
                  cy.get('button#edit-team').click();
                });
              });

              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Delete team?');
                  done();
                });
                cy.get('button#delete-team').click();
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('button#delete-team').click();
                cy.url().should('contain', `/#/organization/${organization.id}`);
              });

              it('removes record from the database', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  cy.get('button#delete-team').click().then(() => {
                    cy.wait(500);
                    cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                      expect(results.length).to.eq(0);
                    });
                  });
                });
              });

              it('renders the interface correctly on completion with success message', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('button#delete-team').click();
                cy.wait(500);
                cy.get('#team-list').should('not.exist');
                cy.contains('Team deleted');
              });
            });
          });

          context('switched off', () => {
            context('member agents exist', () => {
              beforeEach(function() {
                // Logged in as regular agent. Add root as member
                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: root.email } }).then((res) => {

                  // Root login
                  cy.login(root.email, _profile);

                  cy.get('#app-menu-button').click();
                  cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
                  cy.get('#organization-button').click();
                  cy.wait(500);
                  cy.contains(organization.name).should('not.exist');
                  cy.visit(`/#/team/${team.id}`);
                  cy.wait(500);
                });
              });

              it('renders the interface for regular team member', () => {
                cy.get('button#edit-team').should('not.exist');
                cy.get('button#delete-team').should('not.exist');
              });
            });

            context('no member agents exist', () => {
              beforeEach(() => {
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].AgentId).to.eq(regularAgent.id);

                  // Root login
                  cy.login(root.email, _profile);

                  cy.get('#app-menu-button').click();
                  cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
                  cy.get('#organization-button').click();
                  cy.wait(500);
                  cy.contains(organization.name).should('not.exist');
                  cy.visit(`/#/team/${team.id}`);
                  cy.wait(500);
                });
              });

              it('renders the interface for regular team member', () => {
                cy.get('button#edit-team').should('not.exist');
                cy.get('button#delete-team').should('not.exist');
              });
            });
          });
        });
      });
    });
  });
});

export {}
