context('root/Agent show', function() {

  let memberAgent;
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
      cy.login('someotherguy@example.com', _profile, [this.scope.read.agents]);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        memberAgent = results[0];
      });
    });

    describe('admin mode', () => {
      context('switched on', () => {
        describe('viewing member agent\'s profile', () => {
          beforeEach(function() {
            cy.login(_profile.email, _profile);
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.contains('Agent Directory').click();
            cy.wait(200);
            cy.get('.agent-button a').first().click();
            cy.wait(200);
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/agent/${memberAgent.socialProfile.id}`);
          });

          it('displays agent\'s editable info in form', function() {
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

          describe('social profile data', () => {
            it('displays JSON', () => {
              cy.get('.react-json-view').its('length').should('eq', 1);
              cy.get('.react-json-view').contains('locale');
              cy.get('.react-json-view').contains('picture');
              cy.get('.react-json-view').contains('user_id');
              cy.get('.react-json-view').contains('name');
            });
          });
        });

        describe('viewing your own profile', () => {

          let root;
          beforeEach(function() {
            cy.login(_profile.email, _profile);
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.wait(200);
            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
              root = results[0];
              cy.visit(`/#/agent/${root.socialProfile.id}`);
              cy.wait(200);
            });
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/agent/${root.socialProfile.id}`);
          });

          it('displays agent\'s editable info in form', () => {
            cy.get('h3').contains('Profile');
            cy.get('input[name="name"][type="text"]').should('have.value', root.name);
            cy.get('input[name="name"][type="text"]').should('not.be.disabled');
            cy.get('input[name="email"][type="email"]').should('have.value', root.email);
            cy.get('input[name="email"][type="email"]').should('be.disabled');
            cy.get('button[type="submit"]').should('exist');
          });

          describe('social profile data', () => {
            it('displays JSON', () => {
              cy.get('.react-json-view').its('length').should('eq', 1);
              cy.get('.react-json-view').contains('locale');
              cy.get('.react-json-view').contains('picture');
              cy.get('.react-json-view').contains('user_id');
              cy.get('.react-json-view').contains('name');
            });
          });
        });
      });
    });

    context('switched off', () => {
      describe('viewing member agent\'s profile', () => {
        beforeEach(function() {
          cy.login(_profile.email, _profile);
          cy.get('#app-menu-button').click();
          cy.get('#admin-switch').should('not.be.checked');
          cy.visit(`/#/agent/${memberAgent.socialProfile.id}`);
          cy.wait(200);
        });

        it('lands in the right spot', () => {
          cy.url().should('contain', `/#/agent/${memberAgent.socialProfile.id}`);
        });

        it('displays agent\'s editable info in form', function() {
          cy.get('h3').contains('Profile');
          cy.get('input[name="name"][type="text"]').should('have.value', memberAgent.name);
          cy.get('input[name="name"][type="text"]').should('be.disabled');
          cy.get('input[name="email"][type="email"]').should('have.value', memberAgent.email);
          cy.get('input[name="email"][type="email"]').should('be.disabled');
          cy.get('button[type="submit"]').should('not.exist');
        });

        describe('social profile data', () => {
          it('displays JSON', () => {
            cy.get('.react-json-view').its('length').should('eq', 1);
            cy.get('.react-json-view').contains('locale');
            cy.get('.react-json-view').contains('picture');
            cy.get('.react-json-view').contains('user_id');
            cy.get('.react-json-view').contains('name');
          });
        });
      });

      describe('viewing your own profile', () => {

        let root;
        beforeEach(function() {
          cy.login(_profile.email, _profile);
          cy.get('#app-menu-button').click();
          cy.get('#admin-switch').check();
          cy.get('#agent-button').contains('Profile').click();
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
            cy.visit(`/#/agent/${root.socialProfile.id}`);
            cy.wait(500);
          });
        });

        it('lands in the right spot', () => {
          cy.url().should('contain', `/#/agent/${root.socialProfile.id}`);
        });

        it('displays agent\'s editable info in form', () => {
          cy.get('h3').contains('Profile');
          cy.get('input[name="name"][type="text"]').should('have.value', root.name);
          cy.get('input[name="name"][type="text"]').should('not.be.disabled');
          cy.get('input[name="email"][type="email"]').should('have.value', root.email);
          cy.get('input[name="email"][type="email"]').should('be.disabled');
          cy.get('button[type="submit"]').should('exist');
        });

        describe('social profile data', () => {
          it('displays JSON', () => {
            cy.get('.react-json-view').its('length').should('eq', 1);
            cy.get('.react-json-view').contains('locale');
            cy.get('.react-json-view').contains('picture');
            cy.get('.react-json-view').contains('user_id');
            cy.get('.react-json-view').contains('name');
          });
        });
      });
    });
  });
});

export {}
