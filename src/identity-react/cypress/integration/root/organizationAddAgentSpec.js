context('root/Organization add agent', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });


  let root, regularAgent, organization;
  beforeEach(function() {
    // Login/create regular agent
    cy.login('regularguy@example.com', _profile);
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

  describe('to an organization created by root', () => {

    beforeEach(function() {
      cy.login(root.email, _profile);
      cy.request({ url: '/organization', method: 'POST', body: { name: 'Roots' } }).then((org) => {
        organization = org.body;
      });
    });

    describe('admin mode', () => {
      context('switched on', () => {
        beforeEach(function() {
          cy.login(root.email, _profile);
          cy.get('#app-menu-button').click();
          cy.get('#admin-switch').check();
          cy.get('#organization-button').click();
          cy.wait(500);
          cy.contains(organization.name).click();
          cy.wait(500);
          cy.get('button#add-agent').click();
        });

        it('creates agent record in the database', function() {
          cy.task('query', `SELECT * FROM "Agents" WHERE email='somenewguy@example.com';`).then(([results, metadata]) => {
            expect(results.length).to.eq(0);
            cy.get('input[name="email"][type="email"]').type('somenewguy@example.com');
            cy.get('button[type="submit"]').click();
            cy.wait(500);
            cy.task('query', `SELECT * FROM "Agents" WHERE email='somenewguy@example.com';`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
            });
          });
        });

        it('updates the record on the interface', function() {
          cy.get('#organization-member-list').should('exist');
          cy.get('#organization-member-list').find('.list-item').its('length').should('eq', 1);
          cy.get('#organization-member-list .list-item').first().contains(root.email);
          cy.get('input[name="email"][type="email"]').type('somenewguy@example.com');
          cy.get('button[type="submit"]').click();
          cy.wait(500);
          cy.get('#organization-member-list').find('.list-item').its('length').should('eq', 2);
          cy.get('#organization-member-list .list-item').last().contains('somenewguy@example.com');
          cy.get('#organization-member-list .organization-button .delete-member').last().should('exist');
        });
      });

      context('switched off', () => {
        beforeEach(function() {
          cy.login(root.email, _profile);
          cy.get('#app-menu-button').click();
          cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
          cy.get('#organization-button').click();
          cy.wait(500);
          cy.contains(organization.name).click();
          cy.wait(500);
          cy.get('button#add-agent').click();
        });

        it('creates agent record in the database', function() {
          cy.task('query', `SELECT * FROM "Agents" WHERE email='somenewguy@example.com';`).then(([results, metadata]) => {
            expect(results.length).to.eq(0);
            cy.get('input[name="email"][type="email"]').type('somenewguy@example.com');
            cy.get('button[type="submit"]').click();
            cy.wait(500);
            cy.task('query', `SELECT * FROM "Agents" WHERE email='somenewguy@example.com';`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
            });
          });
        });

        it('updates the record on the interface', function() {
          cy.get('#organization-member-list').should('exist');
          cy.get('#organization-member-list').find('.list-item').its('length').should('eq', 1);
          cy.get('#organization-member-list .list-item').first().contains(root.email);
          cy.get('input[name="email"][type="email"]').type('somenewguy@example.com');
          cy.get('button[type="submit"]').click();
          cy.wait(500);
          cy.get('#organization-member-list').find('.list-item').its('length').should('eq', 2);
          cy.get('#organization-member-list .list-item').last().contains('somenewguy@example.com');
          cy.get('#organization-member-list .organization-button .delete-member').last().should('exist');
        });
      });
    });
  });

  describe('to an organization created by a regular agent', () => {
    beforeEach(function() {
      cy.login(regularAgent.email, _profile);
      cy.request({ url: '/organization', method: 'POST', body: { name: 'Regular Organization' } }).then((org) => {
        organization = org.body;
        cy.login(root.email, _profile);
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
          cy.get('button#add-agent').click();
        });

        it('creates agent record in the database', function() {
          cy.task('query', `SELECT * FROM "Agents" WHERE email='somenewguy@example.com';`).then(([results, metadata]) => {
            expect(results.length).to.eq(0);
            cy.get('input[name="email"][type="email"]').type('somenewguy@example.com');
            cy.get('button[type="submit"]').click();
            cy.wait(500);
            cy.task('query', `SELECT * FROM "Agents" WHERE email='somenewguy@example.com';`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
            });
          });
        });

        it('updates the record on the interface', function() {
          cy.get('#organization-member-list').should('exist');
          cy.get('#organization-member-list').find('.list-item').its('length').should('eq', 1);
          cy.get('#organization-member-list .list-item').first().contains(regularAgent.email);
          cy.get('input[name="email"][type="email"]').type('somenewguy@example.com');
          cy.get('button[type="submit"]').click();
          cy.wait(500);
          cy.get('#organization-member-list').find('.list-item').its('length').should('eq', 2);
          cy.get('#organization-member-list .list-item').last().contains('somenewguy@example.com');
          cy.get('#organization-member-list .organization-button .delete-member').last().should('exist');
        });
      });

      context('switched off', () => {
        beforeEach(function() {
          cy.get('#app-menu-button').click();
          cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
          cy.get('#organization-button').click();
          cy.wait(500);
          cy.contains(organization.name).should('not.exist');
          cy.visit(`/#/organization/${organization.id}`); 
        });

        // A root agent is still a root agent. The only thing contstraining
        // the root agent from changing data is the interface itself.
        it('does not display the edit button', () => {
          cy.get('button#add-agent').should('not.exist');
        });
      });
    });
  });
});

export {}
