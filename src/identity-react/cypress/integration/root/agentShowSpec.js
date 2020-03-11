context('root/Agent show', function() {

  let memberAgent;
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
      cy.visit(`/#/agent/333`);
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

    let memberAgent;
    beforeEach(function() {
      // Just a convenient way to create a new agent
      cy.login('someotherguy@example.com', _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        memberAgent = results[0];
      });
    });
 
    describe('viewing member agent\'s profile', () => {
      beforeEach(function() {
        cy.login(_profile.email, _profile);
        cy.get('#app-menu-button').click();
        cy.get('#admin-switch').check();
        cy.visit(`/#/agent/${memberAgent.id}`);
        cy.wait(500);
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/agent/${memberAgent.id}`);
      });

      it('displays agent social profile info in form', function() {
        cy.get('h3').contains('Profile');
        cy.get('input[name="name"][type="text"]').should('have.value', memberAgent.name);
        cy.get('input[name="name"][type="text"]').should('not.be.disabled');
        cy.get('input[name="email"][type="email"]').should('have.value', memberAgent.email);
        cy.get('input[name="email"][type="email"]').should('be.disabled');
        cy.get('button[type="submit"]').should('exist');
      });

      it('disables the Save button', () => {
        cy.get('button[type="submit"]').should('be.disabled');
      });
    });

    describe('viewing your own profile', () => {

      let root;
      beforeEach(function() {
        cy.login(_profile.email, _profile);
        cy.get('#app-menu-button').click();
        cy.get('#admin-switch').check();
        cy.contains('Profile').click();
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          root = results[0];
          cy.visit(`/#/agent/${root.id}`);
          cy.wait(500);
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/agent/${root.id}`);
      });

      it('displays agent social profile info in form', () => {
        cy.get('h3').contains('Profile');
        cy.get('input[name="name"][type="text"]').should('have.value', root.name);
        cy.get('input[name="name"][type="text"]').should('not.be.disabled');
        cy.get('input[name="email"][type="email"]').should('have.value', root.email);
        cy.get('input[name="email"][type="email"]').should('be.disabled');
        cy.get('button[type="submit"]').should('exist');
      });
    });
  });
});

export {}
