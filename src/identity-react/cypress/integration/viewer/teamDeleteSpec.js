context('Team delete', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  let agent, anotherAgent;
  beforeEach(function() {
    // Login/create main test agent
    cy.login(_profile.email, _profile, [this.scope.read.agents,
                                        this.scope.create.teams,
                                        this.scope.read.teams,
                                        this.scope.update.teams,
                                        this.scope.delete.teams,
                                        this.scope.create.teamMembers ]);

    cy.get('button span span').contains('add_box').click();
    cy.get('input[placeholder="Name"]').type('The A-Team');
    cy.get('button[title="Save"]').click();
    cy.wait(300);
    cy.contains('The A-Team').click();
    cy.wait(300);
  });

  describe('Deleting', () => {

//    let organization, team;
//    beforeEach(function() {
//      cy.request({ url: '/team', method: 'POST', body: {name: 'The A Team' } }).then(res => {
//        team = res.body;
//        cy.visit('/#/').then(() => {
//          cy.contains('The A Team').click();
//          cy.wait(300);
//        });
//      });
//    });

    describe('Delete button', () => {
      context('when team has team members', () => {
//        beforeEach(function() {
//          cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: anotherAgent.email } }).then((res) => {
//            cy.visit('/#/').then(() => {
//              cy.get('#app-menu-button').click();
//              cy.get('#organization-button').click();
//              cy.contains('One Book Canada').click();
//            });
//          });
//        });
//
//        it('does not allow deletion', function(done) {
//          cy.on('window:alert', (str) => {
//            expect(str).to.eq('Remove all team members before deleting the team');
//            done();
//          });
//          cy.get('#organization-team-list').find('.list-item').its('length').should('eq', 1);
//          cy.get('.delete-team').first().click();
//        });
      });

      context('when team has no team members', () => {
        it('displays a popup warning', function(done) {
          cy.on('window:confirm', (str) => {
            expect(str).to.eq('Delete team?');
            done();
          });
          cy.get('#delete-team').first().click();
        });

        it('lands in the proper place', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('#delete-team').first().click();
          cy.url().should('contain', '/#/agent');
        });

        it('removes record from the team leader\'s user_metadata', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
            expect(results.length).to.eq(1);
            expect(results[0].socialProfile.user_metadata.teams.length).to.eq(1);
            cy.get('#delete-team').click();
            cy.wait(300);
            cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
              expect(results[0].socialProfile.user_metadata.teams.length).to.eq(0);
            });
          });
        });

        it('renders the interface correctly on completion with success message', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('#delete-team').click();
          cy.wait(300);
          cy.get('table tbody tr td').contains('No records to display');
          cy.get('#flash-message').contains('Team deleted');
        });
      });

//      describe('on team edit page', () => {
//        context('when team has team members', () => {
//          beforeEach(function() {
//            cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: anotherAgent.email } }).then((res) => {
//              cy.visit('/#/').then(() => {
//                cy.get('#app-menu-button').click();
//                cy.get('#organization-button').click();
//                cy.contains('One Book Canada').click();
//                cy.contains(team.name).click();
//                cy.get('button#edit-team').click();
//              });
//            });
//          });
//
//          it('does not allow deletion', function(done) {
//            cy.on('window:alert', (str) => {
//              expect(str).to.eq('Remove all team members before deleting the team');
//              done();
//            });
//            cy.get('button#delete-team').click();
//          });
//        });
//
//        context('when team has no team members', () => {
//          beforeEach(() => {
//            cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
//              expect(results.length).to.eq(1);
//              expect(results[0].AgentId).to.eq(agent.id);
//              cy.visit('/#/').then(() => {
//                cy.get('#app-menu-button').click();
//                cy.get('#organization-button').click();
//                cy.contains('One Book Canada').click();
//                cy.contains(team.name).click();
//                cy.get('button#edit-team').click();
//              });
//            });
//          });
//
//          it('displays a popup warning', function(done) {
//            cy.on('window:confirm', (str) => {
//              expect(str).to.eq('Delete team?');
//              done();
//            });
//            cy.get('button#delete-team').click();
//          });
//
//          it('lands in the proper place', () => {
//            cy.on('window:confirm', (str) => {
//              return true;
//            });
//            cy.get('button#delete-team').click();
//            cy.url().should('contain', `/#/organization/${organization.id}`);
//          });
//
//          it('removes record from the database', () => {
//            cy.on('window:confirm', (str) => {
//              return true;
//            });
//            cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
//              expect(results.length).to.eq(1);
//              cy.get('button#delete-team').click();
//              cy.wait(500);
//              cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
//                expect(results.length).to.eq(0);
//              });
//            });
//          });
//
//          it('renders the interface correctly on completion with success message', () => {
//            cy.on('window:confirm', (str) => {
//              return true;
//            });
//            cy.get('button#delete-team').click();
//            cy.wait(500);
//            cy.get('#organization-team-list').should('not.exist');
//            cy.contains('Team deleted');
//          });
//        });
//      });
    });
  });
});

export {}
