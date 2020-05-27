context('viewer/Team show', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/team/1');
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

    let agent, anotherAgent, teamId;
    beforeEach(function() {
      teamId = 'some-uuid-v4';

      // Create another team member
      cy.login('someotherguy@example.com', {..._profile, user_metadata: {
                                                 teams: [
                                                   {
                                                     id: teamId,
                                                     name: 'The Calgary Roughnecks',
                                                     leader: _profile.email,
                                                   }
                                                 ]
                                               }, name: 'Some Other Guy' }, [this.scope.read.agents]);

      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        anotherAgent = results[0];

        cy.login(_profile.email, {..._profile, user_metadata: {
                                                 teams: [
                                                   {
                                                     id: teamId,
                                                     name: 'The Calgary Roughnecks',
                                                     leader: _profile.email,
                                                   }
                                                 ]
                                               } }, [this.scope.read.agents]);

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
          cy.reload(true);
          cy.wait(300);
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    });

    it('doesn\'t barf if team doesn\'t exist', () => {
      cy.visit('/#/team/333');
      cy.get('#error-message').contains('No such team');
    });

    context('visit by team creator', () => {
      let team;
      beforeEach(function() {
        cy.visit('/#/agent');
        cy.wait(300);
        cy.contains('The Calgary Roughnecks').click();
        cy.wait(300);
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${teamId}`);
      });

      it('displays appropriate Team interface elements', function() {
        cy.get('table tbody tr td input#team-name-field').should('have.value', agent.socialProfile.user_metadata.teams[0].name);
        cy.get('table tbody tr td').contains(_profile.email);
        cy.get('button#delete-team').should('exist');
        cy.get('button#save-team').should('not.exist');
        cy.get('button#cancel-team-changes').should('not.exist');
      });

      it('displays team members in a table', function() {
        cy.get('h6').contains('Members');
        cy.get('table tbody tr td').contains('No records to display').should('not.exist');
        cy.get('button span span').contains('add_box').should('exist');

        cy.get('table thead tr th').contains('Name');
        cy.get('table thead tr th').contains('Email');
        // Member agent can be deleted
        cy.get('table tbody tr:nth-of-type(1) button[title=Delete]').should('exist');
        cy.get('table tbody tr:nth-of-type(1) td a').should('contain', anotherAgent.name).and('have.attr', 'href').and('equal', `#agent/${anotherAgent.socialProfile.user_id}`);
        cy.get('table tbody tr:nth-of-type(1) td').contains(anotherAgent.socialProfile.email);
        // Team leader cannot be deleted
        cy.get('table tbody tr:nth-of-type(2) button[title=Delete]').should('not.exist');
        cy.get('table tbody tr:nth-of-type(2) td a').should('contain', agent.name).and('have.attr', 'href').and('equal', `#agent/${agent.socialProfile.user_id}`);
        cy.get('table tbody tr:nth-of-type(2) td').contains(agent.socialProfile.user_metadata.teams[0].leader);
      });
    });

    context('verified team member agent visit', () => {

      beforeEach(function() {
        // Membership established in first `beforeEach`
        cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy'}, [this.scope.read.agents]);
        cy.contains('The Calgary Roughnecks').click();
        cy.wait(300);
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${teamId}`);
      });

      it('displays appropriate Team interface elements', function() {
        cy.get('table tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
        cy.get('table tbody tr td input#team-name-field').should('be.disabled');
        cy.get('table tbody tr td').contains(_profile.email);
        cy.get('button#delete-team').should('not.exist');
        cy.get('button#save-team').should('not.exist');
        cy.get('button#cancel-team-changes').should('not.exist');
      });

      it('displays team members in a table', function() {
        cy.get('h6').contains('Members');
        cy.get('table tbody tr td').contains('No records to display').should('not.exist');
        cy.get('table tbody tr td input#team-name-field').should('have.value', agent.socialProfile.user_metadata.teams[0].name);

        // 2020-5-5 Why doesn't this work?
        // cy.get('button span span').contains('add_box').should('not.exist');
        cy.get('button span span').should('not.exist');

        cy.get('table thead tr th').contains('Name');
        cy.get('table thead tr th').contains('Email');
        cy.get('table tbody tr:nth-of-type(1) button[title=Delete]').should('not.exist');
        cy.get('table tbody tr:nth-of-type(1) td a').should('contain', agent.name).and('have.attr', 'href').and('equal', `#agent/${agent.socialProfile.user_id}`);
        cy.get('table tbody tr:nth-of-type(1) td').contains(agent.socialProfile.user_metadata.teams[0].leader);
        cy.get('table tbody tr:nth-of-type(2) button[title=Delete]').should('not.exist');
        cy.get('table tbody tr:nth-of-type(2) td a').should('contain', anotherAgent.name).and('have.attr', 'href').and('equal', `#agent/${anotherAgent.socialProfile.user_id}`);
        cy.get('table tbody tr:nth-of-type(2) td').contains(anotherAgent.socialProfile.email);
      });
    });

    context('non-member agent visit', () => {

      let team;
      beforeEach(function() {
        // Login/create another agent
        cy.login('someunknownguy@example.com', _profile, [this.scope.read.agents]);
        cy.wait(300);
      });

      it('displays a friendly message', () => {
        cy.visit(`/#/team/${teamId}`);
        cy.wait(500);
        cy.get('h3').contains('You are not a member of that team');
      });
    });
  });
});

export {}
