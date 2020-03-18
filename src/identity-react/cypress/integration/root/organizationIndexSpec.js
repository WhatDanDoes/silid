context('root/Organization', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });
 
  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/organization/admin');
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

    beforeEach(function() {
      cy.login(_profile.email, _profile);
    });

    context('admin mode', () => {

      beforeEach(function() {
        cy.get('#app-menu-button').click();
        cy.get('#admin-switch').check();
        cy.contains('Organization Directory').click();
      });
 
      afterEach(() => {
        cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
      });
  
      it('lands in the right spot', () => {
        cy.url().should('contain', '/#/organization/admin');
      });
  
      it('displays common Organization interface elements', function() {
        cy.get('h3').contains('Organizations');
        cy.get('button#add-organization').should('exist');
      });
  
      context('no organizations', () => {
        it('displays no organizations', () => {
          cy.task('query', 'SELECT * FROM "Organizations";').then(([results, metadata]) => {
            expect(results.length).to.equal(0);
            cy.get('#organization-list').should('not.exist');
          });
        });
      });

      context('some organizations', () => {
        let organization;
        beforeEach(function() {

          // Create an organization with another agent
          cy.login('someotherguy@example.com', _profile);
          cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then(org => {
            organization = org.body;

            // Login root agent
            cy.login(_profile.email, _profile);
            cy.visit('/#/');
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.contains('Organization Directory').click();

          });
        });

        it('displays a list of organizations', () => {
          cy.get('#organization-list').should('exist');
          cy.get('#organization-list').find('.organization-button').its('length').should('eq', 1);
          cy.get('.organization-button').first().contains('One Book Canada');
          cy.get('.organization-button a').first().should('have.attr', 'href').and('include', `#organization/${organization.id}`)
        });
      });
    });
  });
});

export {}
