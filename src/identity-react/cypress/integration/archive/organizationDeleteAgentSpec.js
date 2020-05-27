context('Organization delete agent', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  context('authenticated', () => {

    let agent, memberAgent;
    beforeEach(function() {
      cy.login('someotherguy@example.com', _profile, [this.scope.read.agents]);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        memberAgent = results[0];

        cy.login(_profile.email, _profile, [this.scope.read.agents,
                                            this.scope.create.organizations,
                                            this.scope.read.organizations,
                                            this.scope.create.organizationMembers,
                                            this.scope.delete.organizationMembers]);
        cy.visit('/#/').then(() => {
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            agent = results[0];
          });
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "OrganizationMembers" CASCADE;');
    });

    context('creator agent visit', () => {

      let organization;
      beforeEach(function() {
        cy.request({ url: '/organization', method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
          organization = org.body;
          cy.request({ url: `/organization/${organization.id}/agent`, method: 'PUT', body: { email: memberAgent.email } }).then((org) => {
            cy.get('#app-menu-button').click();
            cy.get('#organization-button').click();
            cy.contains('One Book Canada').click();
          });
        });
      });

      describe('delete-member button', () => {
        it('does not display a delete button next to the creator agent', () => {
          cy.contains(agent.email).siblings('.delete-member').should('not.exist');
          cy.contains(memberAgent.email).siblings('.delete-member').should('exist');
        });

        it('displays a popup warning', function(done) {
          cy.on('window:confirm', (str) => {
            expect(str).to.eq('Remove member?');
            done();
          });
          cy.get('#organization-member-list .list-item').first().contains(memberAgent.email);
          cy.get('.delete-member').last().click();
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

        it('lands in the proper place', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.url().should('contain', `/#/organization/${organization.id}`);
          cy.get('.delete-member').last().click();
          cy.wait(500);
          cy.url().should('contain', `/#/organization/${organization.id}`);
        });

        it('displays a success message', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('.delete-member').last().click();
          cy.wait(500);
          cy.contains(`Member removed`);
        });
      });
    });

    context('member agent visit', () => {

      let organization;
      beforeEach(function() {
        cy.request({ url: '/organization', method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
          organization = org.body;
          cy.request({ url: `/organization/${organization.id}/agent`, method: 'PUT', body: { email: memberAgent.email } }).then((org) => {
            cy.login(memberAgent.email, _profile, [this.scope.read.agents, this.scope.read.organizations]);
            cy.get('#app-menu-button').click();
            cy.get('#organization-button').click();
            cy.contains('One Book Canada').click();
          });
        });
      });

      it('displays common Organization interface elements', function() {
        cy.get('.delete-member').should('not.exist');
      });
    });
  });
});

export {}
