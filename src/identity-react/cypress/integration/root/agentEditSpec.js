context('root/Agent edit', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
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

  describe('Editing', () => {
    describe('root\'s own profile', () => {
      describe('admin mode', () => {
        context('switched on', () => {
          context('success', () => {
            let agent, token;
            beforeEach(function() {
              cy.login(_profile.email, _profile);
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.contains('Profile').click();
              cy.wait(500);
            });
      
            it('lands in the right spot', () => {
              cy.url().should('contain', '/#/agent');
            });
      
            it('does not allow an empty field', function() {
              cy.get('input[name="name"][type="text"]:invalid').should('have.length', 0)
              cy.get('input[name="name"][type="text"]').should('have.value', this.profile.name);
              cy.get('input[name="name"][type="text"]').clear();
              cy.get('input[name="name"][type="text"]').should('have.value', '');
              cy.get('button[type="submit"]').click();
              cy.get('input[name="name"][type="text"]:invalid').should('have.length', 1)
              cy.get('input[name="name"][type="text"]:invalid').then($input => {
                expect($input[0].validationMessage).to.eq('name required')
              });
            });
      
            it('updates the record in the database', function() {
              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                cy.get('input[name="name"][type="text"]').should('have.value', results[0].name);
                cy.get('input[name="name"][type="text"]').clear().type('Dick Wolf');
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                  expect(results[0].name).to.eq('Dick Wolf');
                });
              });
            });
      
            it('updates the record on the interface', function() {
              cy.get('input[name="name"][type="text"]').clear().type('Dick Wolf');
              cy.get('button[type="submit"]').click();
              cy.get('input[name="name"][type="text"]').should('have.value', 'Dick Wolf');
              cy.get('button[type="submit"]').should('be.disabled');
              cy.get('button#cancel-changes').should('not.exist');
            });
          });
        });

        context('switched off', () => {
          context('success', () => {
            let agent, token;
            beforeEach(function() {
              cy.login(_profile.email, _profile);
              cy.get('#app-menu-button').click();
              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
              cy.contains('Profile').click().then(() => {
                cy.wait(500); // <--- There has to be a better way!!! Cypress is going too quick for the database
              });
            });
      
            it('lands in the right spot', () => {
              cy.url().should('contain', '/#/agent');
            });
      
            it('does not allow an empty field', function() {
              cy.get('input[name="name"][type="text"]:invalid').should('have.length', 0)
              cy.get('input[name="name"][type="text"]').should('have.value', this.profile.name);
              cy.get('input[name="name"][type="text"]').clear();
              cy.get('input[name="name"][type="text"]').should('have.value', '');
              cy.get('button[type="submit"]').click();
              cy.get('input[name="name"][type="text"]:invalid').should('have.length', 1)
              cy.get('input[name="name"][type="text"]:invalid').then($input => {
                expect($input[0].validationMessage).to.eq('name required')
              });
            });
      
            it('updates the record in the database', function() {
              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                cy.get('input[name="name"][type="text"]').should('have.value', results[0].name);
                cy.get('input[name="name"][type="text"]').clear().type('Dick Wolf');
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                  expect(results[0].name).to.eq('Dick Wolf');
                });
              });
            });
      
            it('updates the record on the interface', function() {
              cy.get('input[name="name"][type="text"]').clear().type('Dick Wolf');
              cy.get('button[type="submit"]').click();
              cy.get('input[name="name"][type="text"]').should('have.value', 'Dick Wolf');
              cy.get('button[type="submit"]').should('be.disabled');
              cy.get('button#cancel-changes').should('not.exist');
            });
          });
        });
      });
    });

    describe('another agent\'s profile', () => {
      let memberAgent;
      beforeEach(function() {
        // Just a convenient way to create a new agent
        cy.login('someotherguy@example.com', { ..._profile, name: 'Some Other Guy' }, [this.scope.read.agents]);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          memberAgent = results[0];
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
          context('success', () => {
            let agent, token;
            beforeEach(function() {
              cy.login(_profile.email, _profile);
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.contains('Agent Directory').click();
              cy.wait(500);
              cy.contains(memberAgent.name).click();
              cy.wait(500);
            });
      
            it('lands in the right spot', () => {
              cy.url().should('contain', `/#/agent/${memberAgent.id}`);
            });
      
            it('does not allow an empty field', function() {
              cy.get('input[name="name"][type="text"]:invalid').should('have.length', 0)
              cy.get('input[name="name"][type="text"]').should('have.value', memberAgent.name);
              cy.get('input[name="name"][type="text"]').clear();
              cy.get('input[name="name"][type="text"]').should('have.value', '');
              cy.get('button[type="submit"]').click();
              cy.get('input[name="name"][type="text"]:invalid').should('have.length', 1)
              cy.get('input[name="name"][type="text"]:invalid').then($input => {
                expect($input[0].validationMessage).to.eq('name required')
              });
            });
      
            it('updates the record in the database', function() {
              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${memberAgent.email}' LIMIT 1;`).then(([results, metadata]) => {
                cy.get('input[name="name"][type="text"]').should('have.value', results[0].name);
                cy.get('input[name="name"][type="text"]').clear().type('Dick Wolf');
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${memberAgent.email}' LIMIT 1;`).then(([results, metadata]) => {
                  expect(results[0].name).to.eq('Dick Wolf');
                });
              });
            });
      
            it('updates the record on the interface', function() {
              cy.get('input[name="name"][type="text"]').clear().type('Dick Wolf');
              cy.get('button[type="submit"]').click();
              cy.get('input[name="name"][type="text"]').should('have.value', 'Dick Wolf');
              cy.get('button[type="submit"]').should('be.disabled');
              cy.get('button#cancel-changes').should('not.exist');
            });
          });
        });

        context('switched off', () => {
          context('success', () => {
            let agent, token;
            beforeEach(function() {
              cy.login(_profile.email, _profile);
              cy.get('#app-menu-button').click();
              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
              cy.get('div[role="presentation"]').first().click(); // Close the menu
              cy.visit('/#/agent/admin');
              cy.wait(500);
              cy.contains(memberAgent.name).click();
              cy.wait(500);
            });
      
            it('lands in the right spot', () => {
              cy.url().should('contain', `/#/agent/${memberAgent.id}`);
            });
      
            it('displays agent social profile info in form', function() {
              cy.get('h3').contains('Profile');
              cy.get('input[name="name"][type="text"]').should('have.value', memberAgent.name);
              cy.get('input[name="name"][type="text"]').should('be.disabled');
              cy.get('input[name="email"][type="email"]').should('have.value', memberAgent.email);
              cy.get('input[name="email"][type="email"]').should('be.disabled');
            });
    
            it('does not show the Save button', () => {
              cy.get('button[type="submit"]').should('not.exist');
            });
          });
        });
      });
    });
  });
});

export {}
