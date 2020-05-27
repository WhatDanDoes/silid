context('viewer/Agent show', function() {

  let memberAgent;
  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Invitations" CASCADE;');
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
      // A convenient way to create a new agent
      cy.login('someotherguy@example.com', _profile, [this.scope.read.agents]);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        memberAgent = results[0];
      });
    });

    describe('viewing member agent\'s profile', () => {
      beforeEach(function() {
        cy.login('someguy@example.com', _profile, [this.scope.read.agents]);
        cy.visit(`/#/agent/${memberAgent.socialProfile.user_id}`);
        cy.wait(300);
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/agent/${memberAgent.socialProfile.user_id}`);
      });

      it('displays agent\'s info', function() {
        cy.get('h3').contains('Profile');
        cy.get('#profile-table table tbody tr th').contains('Name:');
        cy.get('#profile-table table tbody tr td').contains(memberAgent.socialProfile.name);
        cy.get('#profile-table table tbody tr th').contains('Email:');
        cy.get('#profile-table table tbody tr td').contains(memberAgent.socialProfile.email);
        cy.get('#profile-table table tbody tr th').contains('Locale:');
        cy.get('#profile-table table tbody tr td').contains(memberAgent.socialProfile.locale);
      });

      describe('teams', () => {
        it('does not display add-team button', function() {
          cy.get('#teams-table button').should('not.exist');
        });

        describe('none created', () => {
          it('displays teams table', function() {
            cy.get('h6').contains('Teams');
            cy.get('#teams-table table tbody tr td').contains('No records to display');
          });
        });

        describe('some created', () => {
          let agent;
          beforeEach(function() {
            cy.login('someotherguy@example.com', {..._profile, user_metadata: {
                                                     teams: [
                                                       {
                                                         id: 'some-uuid-v4',
                                                         name: 'The Calgary Roughnecks',
                                                         leader: 'someguy@example.com',
                                                         members: ['someguy@example.com', 'someotherguy@example.com']
                                                       }
                                                     ]
                                                   } }, [this.scope.read.agents]);

            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
              memberAgent = results[0];
              cy.login('someguy@example.com', _profile, [this.scope.read.agents]);
              cy.visit(`/#/agent/${memberAgent.socialProfile.user_id}`);
              cy.wait(300);
            });
          });

          it('displays teams in a table', function() {
            cy.get('h6').contains('Teams');
            cy.get('#teams-table table tbody tr td').contains('No records to display').should('not.exist');
            cy.get('#teams-table button span span').should('not.exist');
            cy.get('#teams-table table thead tr th').contains('Name');
            cy.get('#teams-table table tbody tr td').contains(memberAgent.socialProfile.user_metadata.teams[0].name);
            cy.get('#teams-table table tbody tr td a').should('contain', memberAgent.socialProfile.user_metadata.teams[0].name).
              and('have.attr', 'href').and('equal', `#team/${memberAgent.socialProfile.user_metadata.teams[0].id}`);
            cy.get('#teams-table table thead tr th').contains('Leader');
            cy.get('#teams-table table tbody tr td').contains(memberAgent.socialProfile.user_metadata.teams[0].leader);
          });
        });
      });

      describe('social profile data', () => {
        it('toggles JSON display', () => {
          cy.get('.react-json-view').its('length').should('eq', 1);

          // Toggle closed
          cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
          cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
          cy.get('.react-json-view').contains('name').should('not.exist');

          // Toggle open
          cy.get('.react-json-view .icon-container .collapsed-icon').click();
          cy.get('.react-json-view .icon-container .expanded-icon').should('exist');

          cy.get('.react-json-view').contains('locale');
          cy.get('.react-json-view').contains('picture');
          cy.get('.react-json-view').contains('user_id');
          cy.get('.react-json-view').contains('name');

          // Toggle closed again
          cy.get('.react-json-view .icon-container .expanded-icon').click();
          cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
          cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
          cy.get('.react-json-view').contains('name').should('not.exist');
        });
      });
    });

    describe('viewing your own profile', () => {

      let agent;
      beforeEach(function() {
        cy.login('someguy@example.com', _profile, [this.scope.read.agents]);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
          cy.visit(`/#/agent/${agent.socialProfile.user_id}`);
          cy.wait(500);
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/agent/${agent.socialProfile.user_id}`);
      });

      it('displays agent\'s info', function() {
        cy.get('h3').contains('Profile');
        cy.get('#profile-table table tbody tr th').contains('Name:');
        cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.name);
        cy.get('#profile-table table tbody tr th').contains('Email:');
        cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.email);
        cy.get('#profile-table table tbody tr th').contains('Locale:');
        cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.locale);
      });

      describe('teams', () => {
        it('displays add-team button', function() {
          cy.get('#teams-table button span span').contains('add_box');
        });

        describe('none created', () => {
          it('displays teams table', function() {
            cy.get('h6').contains('Teams');
            cy.get('#teams-table table tbody tr td').contains('No records to display');
          });
        });

        describe('some created', () => {
          let agent;
          beforeEach(function() {
            cy.login('someguy@example.com', {..._profile, user_metadata: {
                                                     teams: [
                                                       {
                                                         id: 'some-uuid-v4',
                                                         name: 'The Calgary Roughnecks',
                                                         leader: 'someguy@example.com',
                                                         members: ['someguy@example.com']
                                                       }
                                                     ]
                                                   } }, [this.scope.read.agents]);

            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
              agent = results[0];
              cy.reload(true);
              cy.wait(300);
            });
          });

          it('displays teams in a table', function() {
            cy.get('h6').contains('Teams');
            cy.get('#teams-table table tbody tr td').contains('No records to display').should('not.exist');
            cy.get('#teams-table button span span').contains('add_box');
            cy.get('#teams-table table thead tr th').contains('Name');
            cy.get('#teams-table table tbody tr td').contains(agent.socialProfile.user_metadata.teams[0].name);
            cy.get('#teams-table table tbody tr td a').should('contain', agent.socialProfile.user_metadata.teams[0].name).
              and('have.attr', 'href').and('equal', `#team/${agent.socialProfile.user_metadata.teams[0].id}`);
            cy.get('#teams-table table thead tr th').contains('Leader');
            cy.get('#teams-table table tbody tr td').contains(agent.socialProfile.user_metadata.teams[0].leader);
          });
        });
      });

      describe('social profile data', () => {
        it('toggles JSON display', () => {
          cy.get('.react-json-view').its('length').should('eq', 1);

          // Toggle closed
          cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
          cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
          cy.get('.react-json-view').contains('name').should('not.exist');

          // Toggle open
          cy.get('.react-json-view .icon-container .collapsed-icon').click();
          cy.get('.react-json-view .icon-container .expanded-icon').should('exist');

          cy.get('.react-json-view').contains('locale');
          cy.get('.react-json-view').contains('picture');
          cy.get('.react-json-view').contains('user_id');
          cy.get('.react-json-view').contains('name');

          // Toggle closed again
          cy.get('.react-json-view .icon-container .expanded-icon').click();
          cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
          cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
          cy.get('.react-json-view').contains('name').should('not.exist');
        });
      });
    });
  });
});

export {}