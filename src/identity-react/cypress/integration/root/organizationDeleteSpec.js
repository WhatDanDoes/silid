context('root/Organization delete', function() {

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
    cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "organization_team" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "OrganizationMembers" CASCADE;');
  });

  let memberAgent;
  beforeEach(function() {
    cy.login('someotherguy@example.com', _profile, [this.scope.read.agents, this.scope.read.organizations]);
    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
      memberAgent = results[0];
    });
  });

  describe('Deleting', () => {
    let root, organization;

    describe('root\'s own organization', () => {
      beforeEach(function() {
        cy.login(_profile.email, _profile);
        cy.visit('/#/').then(() => {
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
    
            cy.request({ url: '/organization',  method: 'POST', body: { name: 'Roots' } }).then((org) => {
              organization = org.body;
            });
          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
          context('member agents exist', () => {
            beforeEach(function() {
              cy.request({ url: '/organization',  method: 'PATCH', body: { id: organization.id, memberId: memberAgent.id } }).then((res) => {
                cy.visit('/#/').then(() => {
                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.get('#organization-button').click();
                  cy.contains(organization.name).click();
                  cy.wait(500);
                  cy.get('button#edit-organization').click();
                });
              });
            });
    
            it('does not allow deletion', function(done) {
              cy.on('window:alert', (str) => {
                expect(str).to.eq('Remove all members and teams before deleting organization');
                done();
              });
              cy.get('button#delete-organization').click();
            });
          });
    
          context('member teams exist', () => {
            beforeEach(() => {
              cy.request({ url: '/team',  method: 'POST', body: { organizationId: organization.id, name: 'Omega Squadron' } }).then(res => {
                cy.visit('/#/').then(() => {
                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.get('#organization-button').click();
                  cy.contains(organization.name).click();
                  cy.wait(500);
                  cy.get('button#edit-organization').click();
                });
              });
            });
    
            it('does not allow deletion', function(done) {
              cy.on('window:alert', (str) => {
                expect(str).to.eq('Remove all members and teams before deleting organization');
                done();
              });
              cy.get('button#delete-organization').click();
            });
          });
    
          context('no members or teams exist', () => {
            beforeEach(() => {
              cy.task('query', `SELECT * FROM "organization_team";`).then(([results, metadata]) => {
                expect(results.length).to.eq(0);
                cy.task('query', `SELECT * FROM "OrganizationMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].AgentId).to.eq(root.id);
                  cy.visit('/#/').then(() => {
                    cy.get('#app-menu-button').click();
                    cy.get('#admin-switch').check();
                    cy.get('#organization-button').click();
                    cy.contains(organization.name).click();
                    cy.wait(500);
                    cy.get('button#edit-organization').click();
                  });
                });
              });
            });
    
            it('displays a popup warning', function(done) {
              cy.on('window:confirm', (str) => {
                expect(str).to.eq('Are you sure you want to delete this organization?');
                done();
              });
              cy.get('button#delete-organization').click();
            });
    
            it('lands in the proper place', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('button#delete-organization').click();
              cy.url().should('match', /\/#\/organization$/);
            });
    
            it('removes record from the database', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.task('query', `SELECT * FROM "Organizations";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                cy.get('button#delete-organization').click().then(() => {
                  cy.wait(500);
                  cy.task('query', `SELECT * FROM "Organizations";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(0);
                  });
                });
              });
            });
    
            it('renders the interface correctly on completion with success message', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('button#delete-organization').click();
              cy.get('#organization-list').should('not.exist');
              cy.contains('Organization deleted');
            });
          });
        });
 
        context('switched off', () => {
          context('member agents exist', () => {
            beforeEach(function() {
              cy.request({ url: '/organization',  method: 'PATCH', body: { id: organization.id, memberId: memberAgent.id } }).then((res) => {
                cy.visit('/#/').then(() => {
                  cy.get('#app-menu-button').click();
                  cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
                  cy.get('#organization-button').click();
                  cy.contains(organization.name).click();
                  cy.wait(500);
                  cy.get('button#edit-organization').click();
                });
              });
            });
    
            it('does not allow deletion', function(done) {
              cy.on('window:alert', (str) => {
                expect(str).to.eq('Remove all members and teams before deleting organization');
                done();
              });
              cy.get('button#delete-organization').click();
            });
          });
    
          context('member teams exist', () => {
            beforeEach(() => {
              cy.request({ url: '/team',  method: 'POST', body: { organizationId: organization.id, name: 'Omega Squadron' } }).then(res => {
                cy.visit('/#/').then(() => {
                  cy.get('#app-menu-button').click();
                  cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
                  cy.get('#organization-button').click();
                  cy.contains(organization.name).click();
                  cy.wait(500);
                  cy.get('button#edit-organization').click();
                });
              });
            });
    
            it('does not allow deletion', function(done) {
              cy.on('window:alert', (str) => {
                expect(str).to.eq('Remove all members and teams before deleting organization');
                done();
              });
              cy.get('button#delete-organization').click();
            });
          });
    
          context('no members or teams exist', () => {
            beforeEach(() => {
              cy.task('query', `SELECT * FROM "organization_team";`).then(([results, metadata]) => {
                expect(results.length).to.eq(0);
                cy.task('query', `SELECT * FROM "OrganizationMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].AgentId).to.eq(root.id);
                  cy.visit('/#/').then(() => {
                    cy.get('#app-menu-button').click();
                    cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
                    cy.get('#organization-button').click();
                    cy.contains(organization.name).click();
                    cy.wait(500);
                    cy.get('button#edit-organization').click();
                  });
                });
              });
            });
    
            it('displays a popup warning', function(done) {
              cy.on('window:confirm', (str) => {
                expect(str).to.eq('Are you sure you want to delete this organization?');
                done();
              });
              cy.get('button#delete-organization').click();
            });
    
            it('lands in the proper place', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('button#delete-organization').click();
              cy.url().should('match', /\/#\/organization$/);
            });
    
            it('removes record from the database', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.task('query', `SELECT * FROM "Organizations";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                cy.get('button#delete-organization').click().then(() => {
                  cy.wait(500);
                  cy.task('query', `SELECT * FROM "Organizations";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(0);
                  });
                });
              });
            });
    
            it('renders the interface correctly on completion with success message', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('button#delete-organization').click();
              cy.get('#organization-list').should('not.exist');
              cy.contains('Organization deleted');
            });
          });
        });
      });
    });

    describe('an organization created by a regular agent', () => {

      describe('admin mode', () => {

        let regularAgent;
        beforeEach(function() {
          // Login/create regular agent
          cy.login('regularguy@example.com', _profile, [this.scope.read.agents,
                                                        this.scope.create.organizations,
                                                        this.scope.create.teams,
                                                        this.scope.update.organizations,
                                                        this.scope.read.organizations]);
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
            regularAgent = results[0];

            cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then(org => {
              organization = org.body;
            });
          });
        });

        context('switched on', () => {
          context('member agents exist', () => {
            beforeEach(function() {
              // Still regular agent
              cy.request({ url: '/organization',  method: 'PATCH', body: { id: organization.id, memberId: memberAgent.id } }).then((res) => {

                // Login/create root
                cy.login(_profile.email, _profile);
                cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                  root = results[0];
                  cy.visit('/#/');
                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.contains('Organization Directory').click();
                  cy.contains(organization.name).click();
                  cy.wait(500);
                  cy.get('button#edit-organization').click();
                });
              });
            });

            it('does not allow deletion', function(done) {
              cy.on('window:alert', (str) => {
                expect(str).to.eq('Remove all members and teams before deleting organization');
                done();
              });
              cy.get('button#delete-organization').click();
            });
          });

          context('member teams exist', () => {
            beforeEach(() => {
              // Still regular agent
              cy.request({ url: '/team',  method: 'POST', body: { organizationId: organization.id, name: 'Omega Squadron' } }).then(res => {

                // Login/create root
                cy.login(_profile.email, _profile);
                cy.visit('/#/').then(() => {
                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.get('#organization-button').click();
                  cy.contains(organization.name).click();
                  cy.wait(500);
                  cy.get('button#edit-organization').click();
                });
              });
            });

            it('does not allow deletion', function(done) {
              cy.on('window:alert', (str) => {
                expect(str).to.eq('Remove all members and teams before deleting organization');
                done();
              });
              cy.get('button#delete-organization').click();
            });
          });

          context('no members or teams exist', () => {
            beforeEach(() => {
              cy.task('query', `SELECT * FROM "organization_team";`).then(([results, metadata]) => {
                expect(results.length).to.eq(0);
                cy.task('query', `SELECT * FROM "OrganizationMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].AgentId).to.eq(regularAgent.id);

                  // Login/create root
                  cy.login(_profile.email, _profile);
                  cy.visit('/#/').then(() => {
                    cy.get('#app-menu-button').click();
                    cy.get('#admin-switch').check();
                    cy.contains('Organization Directory').click();
                    cy.contains(organization.name).click();
                    cy.wait(500);
                    cy.get('button#edit-organization').click();
                  });
                });
              });
            });

            it('displays a popup warning', function(done) {
              cy.on('window:confirm', (str) => {
                expect(str).to.eq('Are you sure you want to delete this organization?');
                done();
              });
              cy.get('button#delete-organization').click();
            });

            it('lands in the proper place', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('button#delete-organization').click();
              cy.url().should('match', /\/#\/organization$/);
            });

            it('removes record from the database', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.task('query', `SELECT * FROM "Organizations";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                cy.get('button#delete-organization').click().then(() => {
                  cy.wait(500);
                  cy.task('query', `SELECT * FROM "Organizations";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(0);
                  });
                });
              });
            });

            it('renders the interface correctly on completion with success message', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('button#delete-organization').click();
              cy.get('#organization-list').should('not.exist');
              cy.contains('Organization deleted');
            });
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            // Login/create root
            cy.login(_profile.email, _profile);

            cy.get('#app-menu-button').click();
            cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
            cy.get('#organization-button').click();
            cy.wait(500);
            cy.contains(organization.name).should('not.exist');
            cy.visit(`/#/organization/${organization.id}`);
            cy.wait(500);
          });

          // A root agent is still a root agent. The only thing contstraining
          // the root agent from changing data is the interface itself.
          it('does not display the edit button', () => {
            cy.get('button#edit-organization').should('not.exist');
          });
        });
      });
    });
  });
});

export {}
