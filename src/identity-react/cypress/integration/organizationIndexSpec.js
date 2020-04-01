context('Organization', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/organization');
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
    context('without sufficient scope', () => {
      let agent;
      beforeEach(function() {
        cy.login(_profile.email, _profile, [this.scope.read.agents]);
        cy.wait(300);
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', '/#/organization');
      });

      it('displays a friendly message', () => {
        cy.get('h3').contains('Organizations');
        cy.contains('Insufficient scope');
      });
    });

    context('with sufficient scope', () => {
      let agent;
      beforeEach(function() {
        cy.login(_profile.email, _profile, [this.scope.read.agents,
                                            this.scope.create.organizations,
                                            this.scope.read.organizations]);

        cy.get('#app-menu-button').click();
        cy.get('#organization-button').click().then(() =>  {
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            agent = results[0];
          });
        });
      });

      afterEach(() => {
        cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', '/#/organization');
      });

      it('displays common Organization interface elements', function() {
        cy.get('h3').contains('Organizations');
        cy.get('button#add-organization').should('exist');
      });

      describe('organization membership', () => {
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
            cy.login('someotherguy@example.com', _profile, [this.scope.read.agents,
                                                            this.scope.create.organizations,
                                                            this.scope.update.organizations,
                                                            this.scope.create.organizationMembers]);
            cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then(org => {
              organization = org.body;

              // Add member agent
              cy.request({ url: '/organization', method: 'PATCH', body: { id: organization.id, memberId: agent.id } }).then((res) => {

                // Login member agent
                cy.login(_profile.email, _profile, [this.scope.read.agents,
                                                    this.scope.read.organizations]);

                cy.visit('/#/');
                cy.get('#app-menu-button').click();
                cy.get('#organization-button').click();
              });
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

      describe('organization creator', () => {

        context('no organizations created by this agent', () => {
          it('displays no organizations', () => {
            cy.task('query', `SELECT * FROM "Organizations" WHERE "creatorId"=${agent.id};`).then(([results, metadata]) => {;
              expect(results.length).to.equal(0);
              cy.get('#organization-list').should('not.exist');
            });
          });
        });

        context('agent has created organizations', () => {

          let organization;
          beforeEach(function() {
            cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then(org => {
              organization = org.body;
              cy.visit('/#/');
              cy.get('#app-menu-button').click();
              cy.get('#organization-button').click();
            });
          });

          it('displays a list of organizations', () => {
            cy.request({ url: '/organization',  method: 'GET' }).then(orgs => {
              expect(orgs.body.length).to.eq(1);

              cy.get('#organization-list').should('exist');
              cy.get('#organization-list').find('.organization-button').its('length').should('eq', 1);
              cy.get('.organization-button').first().contains('One Book Canada');
              cy.get('.organization-button a').first().should('have.attr', 'href').and('include', `#organization/${organization.id}`)
            });
          });
        });
      });
    });
  });
});

export {}
