context('Organization delete', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "organization_team" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "OrganizationMembers" CASCADE;');
  });

  let _profile, agent, memberAgent;
  beforeEach(function() {
    _profile = {...this.profile};

    cy.login('someotherguy@example.com', _profile, [this.scope.read.agents, this.scope.read.organizations]);
    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
      memberAgent = results[0];

      cy.login(_profile.email, _profile, [this.scope.read.agents,
                                          this.scope.create.organizations,
                                          this.scope.read.organizations,
                                          this.scope.update.organizations,
                                          this.scope.delete.organizations,
                                          this.scope.create.teams]);

      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        agent = results[0];
      });
    });
  });

  describe('Deleting', () => {

    let organization;
    beforeEach(function() {
      cy.request({ url: '/organization', method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
        organization = org.body;
      });
    });

    describe('Delete button', () => {
      context('member agents exist', () => {
        beforeEach(function() {
          cy.request({ url: '/organization',  method: 'PATCH', body: { id: organization.id, memberId: memberAgent.id } }).then((res) => {
            cy.visit('/#/').then(() => {
              cy.get('#app-menu-button').click();
              cy.get('#organization-button').click();
              cy.contains('One Book Canada').click();
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
              cy.get('#organization-button').click();
              cy.contains('One Book Canada').click();
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
              expect(results[0].AgentId).to.eq(agent.id);
              cy.visit('/#/').then(() => {
                cy.get('#app-menu-button').click();
                cy.get('#organization-button').click();
                cy.contains('One Book Canada').click();
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

export {}