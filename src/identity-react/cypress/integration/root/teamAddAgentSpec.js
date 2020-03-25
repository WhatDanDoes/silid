context('root/Team add agent', function() {

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

  describe('Adding agent to team', () => {

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
          cy.login(regularAgent.email, _profile, [this.scope.read.agents, this.scope.create.organizations, this.scope.update.organizations]);

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
            beforeEach(function() {
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.contains('Team Directory').click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
              cy.get('button#add-agent').click();
            });

            it('updates the record in the database', function() {
              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                expect(results[0].AgentId).to.eq(root.id);
                cy.get('input[name="email"][type="email"]').type(regularAgent.email);
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(2);
                  expect(results[0].AgentId).to.eq(root.id);
                  expect(results[1].AgentId).to.eq(regularAgent.id);
                });
              });
            });

            it('updates the record on the interface', function() {
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
              cy.get('#team-member-list .list-item').first().contains(root.email);
              cy.get('input[name="email"][type="email"]').type(regularAgent.email);
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
              cy.get('#team-member-list .list-item').last().contains(regularAgent.email);
              cy.get('#team-member-list .team-button .delete-member').last().should('exist');
            });
          });

          context('switched off', () => {
            beforeEach(function() {
              cy.get('#app-menu-button').click();
              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
              cy.get('#organization-button').click();
              cy.wait(500);
              cy.contains(organization.name).click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
              cy.get('button#add-agent').click();
            });

            it('updates the record in the database', function() {
              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                expect(results[0].AgentId).to.eq(root.id);
                cy.get('input[name="email"][type="email"]').type(regularAgent.email);
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(2);
                  expect(results[0].AgentId).to.eq(root.id);
                  expect(results[1].AgentId).to.eq(regularAgent.id);
                });
              });
            });

            it('updates the record on the interface', function() {
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
              cy.get('#team-member-list .list-item').first().contains(root.email);
              cy.get('input[name="email"][type="email"]').type(regularAgent.email);
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
              cy.get('#team-member-list .list-item').last().contains(regularAgent.email);
              cy.get('#team-member-list .team-button .delete-member').last().should('exist');
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
            beforeEach(function() {
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.contains('Team Directory').click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
              cy.get('button#add-agent').click();
            });

            it('updates the record in the database', function() {
              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                expect(results[0].AgentId).to.eq(root.id);
                cy.get('input[name="email"][type="email"]').type(regularAgent.email);
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(2);
                  expect(results[0].AgentId).to.eq(root.id);
                  expect(results[1].AgentId).to.eq(regularAgent.id);
                });
              });
            });

            it('updates the record on the interface', function() {
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
              cy.get('#team-member-list .list-item').first().contains(root.email);
              cy.get('input[name="email"][type="email"]').type(regularAgent.email);
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
              cy.get('#team-member-list .list-item').last().contains(regularAgent.email);
              cy.get('#team-member-list .team-button .delete-member').last().should('exist');
            });
          });

          context('switched off', () => {
            beforeEach(function() {
              cy.get('#app-menu-button').click();
              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
              cy.get('#organization-button').click();
              cy.wait(500);
              cy.contains(organization.name).should('not.exist');
              cy.visit(`/#/team/${team.id}`);
              cy.wait(500);
              cy.get('button#add-agent').click();
            });

            it('updates the record in the database', function() {
              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                expect(results[0].AgentId).to.eq(root.id);
                cy.get('input[name="email"][type="email"]').type(regularAgent.email);
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(2);
                  expect(results[0].AgentId).to.eq(root.id);
                  expect(results[1].AgentId).to.eq(regularAgent.id);
                });
              });
            });

            it('updates the record on the interface', function() {
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
              cy.get('#team-member-list .list-item').first().contains(root.email);
              cy.get('input[name="email"][type="email"]').type(regularAgent.email);
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
              cy.get('#team-member-list .list-item').last().contains(regularAgent.email);
              cy.get('#team-member-list .team-button .delete-member').last().should('exist');
            });
          });
        });
      });
    });

    describe('team created by a regular agent', () => {
      describe('when root is an organization member', () => {
        beforeEach(function() {
          cy.login(regularAgent.email, _profile, [this.scope.read.agents, this.scope.update.organizations, this.scope.create.teams]);

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
            beforeEach(() => {
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.contains('Team Directory').click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
              cy.get('button#add-agent').click();
            });

            it('updates the record in the database', function() {
              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                expect(results[0].AgentId).to.eq(regularAgent.id);
                cy.get('input[name="email"][type="email"]').type(root.email);
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(2);
                  expect(results[0].AgentId).to.eq(regularAgent.id);
                  expect(results[1].AgentId).to.eq(root.id);
                });
              });
            });

            it('updates the record on the interface', function() {
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
              cy.get('#team-member-list .list-item').first().contains(regularAgent.email);
              cy.get('input[name="email"][type="email"]').type(root.email);
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
              cy.get('#team-member-list .list-item').last().contains(root.email);
              cy.get('#team-member-list .team-button .delete-member').last().should('exist');
            });
          });

          context('switched off', () => {
            beforeEach(function() {
              cy.get('#app-menu-button').click();
              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
              cy.get('#organization-button').click();
              cy.wait(500);
              cy.contains(organization.name).click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
            });

            it('renders the interface for regular team member', () => {
              cy.get('button#add-agent').should('not.exist');
            });
          });
        });
      });

      describe('when root is not an organization member', () => {
        beforeEach(function() {
          cy.login(regularAgent.email, _profile, [this.scope.read.agents, this.scope.create.teams]);

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
            beforeEach(() => {
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.contains('Team Directory').click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
              cy.get('button#add-agent').click();
            });

            it('updates the record in the database', function() {
              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                expect(results[0].AgentId).to.eq(regularAgent.id);
                cy.get('input[name="email"][type="email"]').type(root.email);
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(2);
                  expect(results[0].AgentId).to.eq(regularAgent.id);
                  expect(results[1].AgentId).to.eq(root.id);
                });
              });
            });

            it('updates the record on the interface', function() {
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
              cy.get('#team-member-list .list-item').first().contains(regularAgent.email);
              cy.get('input[name="email"][type="email"]').type(root.email);
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
              cy.get('#team-member-list .list-item').last().contains(root.email);
              cy.get('#team-member-list .team-button .delete-member').last().should('exist');
            });
          });

          context('switched off', () => {
            beforeEach(function() {
              cy.get('#app-menu-button').click();
              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
              cy.get('#organization-button').click();
              cy.wait(500);
              cy.contains(organization.name).should('not.exist');
              cy.visit(`/#/team/${team.id}`);
              cy.wait(500);
            });

            it('renders the interface for regular team member', () => {
              cy.get('button#add-agent').should('not.exist');
            });
          });
        });
      });
    });
  });
});

export {}
