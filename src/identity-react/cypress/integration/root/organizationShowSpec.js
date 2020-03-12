context('root/Organization show', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });

  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/organization/1');
    });

    it('shows the home page', () => {
      cy.get('header h1').contains('Identity');
    });

    it('displays the login button', () => {
      cy.get('#login-link').contains('Login');
    });

    it('does not display the logout button', () => {
      cy.get('#logout-button').should('not.exist');
    });

    it('redirects home', () => {
      cy.location('pathname').should('equal', '/');
    });
  });

  describe('authenticated', () => {

    let root, regularAgent, organization;
    beforeEach(function() {
      // Login/create regular agent
      cy.login('regularguy@example.com', _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        regularAgent = results[0];
        
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then(org => {
          organization = org.body;

          // Login/create root
          cy.login(_profile.email, _profile);
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
            cy.visit('/#/');
          });
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    });

    describe('admin mode', () => {
      context('switched on', () => {

        beforeEach(function() {
          cy.login(_profile.email, _profile);
          cy.get('#app-menu-button').click();
          cy.get('#admin-switch').check();
        });


        it('doesn\'t barf if organization doesn\'t exist', () => {
          cy.visit('/#/organization/333');
          cy.get('#error-message').contains('No such organization');
        });
 
        describe('viewing organization\'s profile', () => {
   
          beforeEach(function() {
            cy.visit(`/#/organization/${organization.id}`);
            cy.wait(500);
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/organization/${organization.id}`);
          });
 
          it('displays common Organization interface elements', function() {
            cy.get('h3').contains(organization.name);
            cy.get('button#add-team').should('exist');
            cy.get('button#add-agent').should('exist');
            cy.get('button#edit-organization').should('exist');
          });
        });
      });

      context('switched off', () => {

        context('root is member agent', () => {
    
          beforeEach(function() {
            cy.request({ url: '/organization',  method: 'PATCH', body: { id: organization.id, memberId: root.id } }).then(res => {

              // Verify agent membership
              cy.task('query', `SELECT * FROM "OrganizationMembers" WHERE "AgentId"=${root.id};`).then(([results, metadata]) => {
                expect(results.length).to.equal(1);
                expect(results[0].AgentId).to.equal(root.id);

                cy.login(root.email, _profile);
                cy.visit('/#/').then(() => {
                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').should('not.be.checked'); // admin mode disabled
                  cy.get('#organization-button').click();
                  cy.contains('One Book Canada').click();
                });
              });
            });
          });
    
          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/organization/${organization.id}`);
          });
    
          it('displays common Organization interface elements', function() {
            cy.get('h3').contains('One Book Canada');
            cy.get('#edit-organization-form').should('not.exist');
            cy.get('button#edit-organization').should('not.exist');
            cy.get('button#add-team').should('exist');
            cy.get('button#add-agent').should('not.exist');
          });
        });
    
        context('root is non-member', () => {
    
          beforeEach(function() {
            // Verify non-membership
            cy.task('query', `SELECT * FROM "OrganizationMembers" WHERE "AgentId"=${root.id};`).then(([results, metadata]) => {
              expect(results.length).to.equal(0);

              cy.login(root.email, _profile);
              cy.visit('/#/').then(() => {
                cy.get('#app-menu-button').click();
                // admin mode disabled
                cy.get('#admin-switch').should('not.be.checked');
              });
            });
          });

          it('does not display organization in membership list', () => {
            cy.get('#organization-button').click();
            cy.wait(500);
            cy.get('#organization-list').should('not.exist');
          });

          // A root agent is still a root agent. The only thing contstraining
          // the root agent from changing data is the interface itself.
          it('still displays common Organization interface elements', function() {
            cy.visit(`/#/organization/${organization.id}`);
            cy.wait(500);

            cy.get('h3').contains('One Book Canada');
            cy.get('#edit-organization-form').should('not.exist');
            cy.get('button#edit-organization').should('not.exist');
            cy.get('button#add-team').should('exist');
            cy.get('button#add-agent').should('not.exist');
          });
        });
      });
    });
  });
});

export {}
