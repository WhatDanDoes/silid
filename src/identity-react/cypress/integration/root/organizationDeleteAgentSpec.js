context('root/Organization delete agent', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });

  let root, regularAgent, organization;
  beforeEach(function() {
    // Login/create regular agent
    cy.login('regularguy@example.com', _profile, [this.scope.read.agents]);
    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
      regularAgent = results[0];

      // Login/create root agent
      cy.login(_profile.email, _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        root = results[0];
      });
    });
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "OrganizationMembers" CASCADE;');
  });

  describe('from an organization created by root', () => {

    beforeEach(function() {
      cy.login(root.email, _profile);
      cy.request({ url: '/organization', method: 'POST', body: { name: 'Roots' } }).then((org) => {
        organization = org.body;

        cy.request({ url: `/organization/${organization.id}/agent`, method: 'PUT', body: { email: regularAgent.email } }).then((org) => {
          cy.login(root.email, _profile);
        });
      });
    });

    describe('admin mode', () => {
      context('switched on', () => {
        beforeEach(function() {
          cy.get('#app-menu-button').click();
          cy.get('#admin-switch').check();
          cy.get('#organization-button').click();
          cy.wait(500);
          cy.contains(organization.name).click();
          cy.wait(500);
        });

        it('does not display a delete button next to the creator (i.e. root) agent', () => {
          cy.contains(root.email).siblings('.delete-member').should('not.exist');
          cy.contains(regularAgent.email).siblings('.delete-member').should('exist');
        });
  
        it('updates the interface', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('#organization-member-list').find('.list-item').its('length').should('eq', 2);
          cy.get('.delete-member').first().click();
          cy.wait(500);
          cy.get('#organization-member-list').find('.list-item').its('length').should('eq', 1);
        });
  
        it('updates the database', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.task('query', `SELECT * FROM "OrganizationMembers";`).then(([results, metadata]) => {
            expect(results.length).to.eq(2);
            cy.get('.delete-member').first().click();
            cy.wait(500);
            cy.task('query', `SELECT * FROM "OrganizationMembers";`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
            });
          });
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
        });

        it('does not display a delete button next to the creator (i.e. root) agent', () => {
          cy.contains(root.email).siblings('.delete-member').should('not.exist');
          cy.contains(regularAgent.email).siblings('.delete-member').should('exist');
        });
  
        it('updates the interface', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('#organization-member-list').find('.list-item').its('length').should('eq', 2);
          cy.get('.delete-member').first().click();
          cy.wait(500);
          cy.get('#organization-member-list').find('.list-item').its('length').should('eq', 1);
        });
  
        it('updates the database', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.task('query', `SELECT * FROM "OrganizationMembers";`).then(([results, metadata]) => {
            expect(results.length).to.eq(2);
            cy.get('.delete-member').first().click();
            cy.wait(500);
            cy.task('query', `SELECT * FROM "OrganizationMembers";`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
            });
          });
        });
      });
    });
  });

  describe('from an organization created by a regular agent', () => {
    beforeEach(function() {
      cy.login(regularAgent.email, _profile, [this.scope.read.agents, this.scope.create.organizations, this.scope.create.organizationMembers]);
      cy.request({ url: '/organization', method: 'POST', body: { name: 'Regular Organization' } }).then((org) => {
        organization = org.body;

        cy.request({ url: `/organization/${organization.id}/agent`, method: 'PUT', body: { email: root.email } }).then((org) => {
          cy.login(root.email, _profile);
        });
      });
    });

    describe('admin mode', () => {
      context('switched on', () => {
        beforeEach(function() {
          cy.get('#app-menu-button').click();
          cy.get('#admin-switch').check();
          cy.contains('Organization Directory').click();
          cy.contains(organization.name).click();
          cy.wait(500);
        });

        it('does not display a delete button next to the creator (i.e. root) agent', () => {
          cy.contains(regularAgent.email).siblings('.delete-member').should('not.exist');
          cy.contains(root.email).siblings('.delete-member').should('exist');
        });
  
        it('updates the interface', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('#organization-member-list').find('.list-item').its('length').should('eq', 2);
          cy.get('.delete-member').first().click();
          cy.wait(500);
          cy.get('#organization-member-list').find('.list-item').its('length').should('eq', 1);
        });
  
        it('updates the database', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.task('query', `SELECT * FROM "OrganizationMembers";`).then(([results, metadata]) => {
            expect(results.length).to.eq(2);
            cy.get('.delete-member').first().click();
            cy.wait(500);
            cy.task('query', `SELECT * FROM "OrganizationMembers";`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
            });
          });
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
        });

        // A root agent is still a root agent. The only thing contstraining
        // the root agent from changing data is the interface itself.
        it('does not display delete buttons', () => {
          cy.get('.delete-member').should('not.exist');
        });
      });
    });
  });
});

export {}
