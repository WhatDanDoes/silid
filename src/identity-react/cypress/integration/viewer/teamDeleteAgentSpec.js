context('Team delete agent', function() {

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
    cy.task('query', 'TRUNCATE TABLE "Invitations" CASCADE;');
  });

  context('authenticated', () => {

    let agent, memberAgent;
    beforeEach(function() {
      // Login/create another agent
      cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy' }, [this.scope.read.agents]);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        memberAgent = results[0];

        // Login/create main test agent
        cy.login(_profile.email, _profile, [this.scope.read.agents,
                                            this.scope.create.organizations,
                                            this.scope.read.organizations,
                                            this.scope.create.teams,
                                            this.scope.read.teams,
                                            this.scope.update.teams,
                                            this.scope.create.teamMembers,
                                            this.scope.delete.teamMembers]);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
        });
      });
    });

    context('creator agent visit', () => {

      let team;
      beforeEach(function() {
        // Team leader logged in. Create's team...
        cy.get('button span span').contains('add_box').click();
        cy.get('input[placeholder="Name"]').type('The A-Team');
        cy.get('button[title="Save"]').click();
        cy.wait(300);
        cy.contains('The A-Team').click();
        cy.wait(300);
        // ... adds user
        cy.get('#members-table button span span').contains('add_box').click();
        cy.get('#members-table [placeholder="Email"]').type(memberAgent.email);
        cy.get('#members-table button[title="Save"]').click();


        // Invited member logs in...
        cy.login(memberAgent.email, {..._profile, name: memberAgent.name},
                  [this.scope.read.agents,
                   this.scope.create.organizations,
                   this.scope.read.organizations,
                   this.scope.update.organizations,
                   this.scope.create.teams,
                   this.scope.read.teams,
                   this.scope.create.teamMembers,
                   this.scope.delete.teamMembers]);

        // ... accepts the invitation
        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();

        // Refresh agent model to get `socialProfile`
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];

          // Team leader logs in again...
          cy.login(agent.email, _profile, [this.scope.read.agents,
                                           this.scope.create.organizations,
                                           this.scope.read.organizations,
                                           this.scope.create.teams,
                                           this.scope.read.teams,
                                           this.scope.update.teams,
                                           this.scope.create.teamMembers,
                                           this.scope.delete.teamMembers]);

          // ... and views the team
          cy.contains('The A-Team').click();
          cy.wait(300);
        });
     });

    describe('delete-member button', () => {
      it('does not display a delete button next to the creator agent', () => {
        // Member agent
        cy.get('tr:nth-of-type(1) button[title=Delete]').should('exist');
        cy.get('tr:nth-of-type(1) td a').should('contain', memberAgent.name).and('have.attr', 'href').and('equal', `#agent/${memberAgent.socialProfile.user_id}`);
        cy.get('tr:nth-of-type(1) td').contains(memberAgent.socialProfile.email);

        // Creator agent
        cy.get('#members-table tr:nth-of-type(2) button[title=Delete]').should('not.exist');
        cy.get('#members-table tr:nth-of-type(2) td a').should('contain', agent.name).and('have.attr', 'href').and('equal', `#agent/${agent.socialProfile.user_id}`);
        cy.get('#members-table tr:nth-of-type(2) td').contains(agent.socialProfile.user_metadata.teams[0].leader);
      });

      it('displays a popup warning', function(done) {
        cy.on('window:confirm', (str) => {
          expect(str).to.eq('Remove member?');
          done();
        });
        // Delete member
        cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').click();
      });

      it('updates the interface', () => {
        cy.on('window:confirm', (str) => {
          return true;
        });
        cy.get('#members-table table tbody').find('tr').its('length').should('eq', 2);
        // Delete member
        cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').click();
        cy.wait(300);
        cy.get('#members-table table tbody').find('tr').its('length').should('eq', 1);

        // Only the creator agent
        cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
        cy.get('#members-table tr:nth-of-type(1) td a').should('contain', agent.name).and('have.attr', 'href').and('equal', `#agent/${agent.socialProfile.user_id}`);
        cy.get('#members-table tr:nth-of-type(1) td').contains(agent.socialProfile.user_metadata.teams[0].leader);
      });

      it('lands in the proper place', () => {
        cy.on('window:confirm', (str) => {
          return true;
        });
        cy.url().should('contain', `/#/team/${agent.socialProfile.user_metadata.teams[0].id}`);
        // Delete member
        cy.get('tr:nth-of-type(1) button[title=Delete]').click();
        cy.wait(300);
        cy.url().should('contain', `/#/team/${agent.socialProfile.user_metadata.teams[0].id}`);
      });

      it('displays a success message', () => {
        cy.on('window:confirm', (str) => {
          return true;
        });
        cy.get('tr:nth-of-type(1) button[title=Delete]').click();
        cy.wait(300);
        cy.contains(`Member removed`);
      });

      it('displays progress spinner', () => {
        cy.on('window:confirm', (str) => {
          return true;
        });
        cy.get('#progress-spinner').should('not.exist');
        cy.get('tr:nth-of-type(1) button[title=Delete]').click();
        // 2020-5-21
        // Cypress goes too fast for this. Cypress also cannot intercept
        // native `fetch` calls so that the route can be stubbed and delayed.
        // Shamefully, this is currently manually tested, though I suspect
        // I will use this opportunity to learn Jest
        // Despite its name, this test really ensures the spinner disappears
        // after all is said and done
        //cy.get('#progress-spinner').should('exist');
        cy.wait(100);
        cy.get('#progress-spinner').should('not.exist');
      });

      describe('former member agent interface', () => {
        beforeEach(function() {
          // Leader removes member
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('tr:nth-of-type(1) button[title=Delete]').click();
          cy.wait(300);

          // Invited member logs in...
          cy.login(memberAgent.email, {..._profile, name: memberAgent.name},
                    [this.scope.read.agents,
                     this.scope.create.organizations,
                     this.scope.read.organizations,
                     this.scope.update.organizations,
                     this.scope.create.teams,
                     this.scope.read.teams,
                     this.scope.create.teamMembers,
                     this.scope.delete.teamMembers]);
        });

        it('updates the former member\'s interface', () => {
            cy.get('#rsvps-table').should('not.exist');
            cy.get('#teams-table').contains('No records to display').should('exist');
          });
        });
      });
    });
  });


  context('invited agent with own teams', () => {
    let agent, memberAgent;
    beforeEach(function() {
      // Login/create another agent
      cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy' }, [this.scope.read.agents, this.scope.create.teams]);

      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        memberAgent = results[0];

        // To-be-invited agent creates his own team
        cy.get('#teams-table button span span').contains('add_box').click();
        cy.get('#teams-table input[placeholder="Name"]').type('The A-Team');
        cy.get('#teams-table button[title="Save"]').click();

        // Login/create main test agent
        cy.login(_profile.email, _profile, [this.scope.read.agents,
                                            this.scope.create.organizations,
                                            this.scope.read.organizations,
                                            this.scope.create.teams,
                                            this.scope.read.teams,
                                            this.scope.update.teams,
                                            this.scope.create.teamMembers,
                                            this.scope.delete.teamMembers]);

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];

          // Team leader creates a own team
          cy.get('#teams-table button span span').contains('add_box').click();
          cy.get('#teams-table input[placeholder="Name"]').type('The Mike Tyson Mystery Team');
          cy.get('#teams-table button[title="Save"]').click();
          cy.wait(300);
          cy.contains('The Mike Tyson Mystery Team').click();
          cy.wait(300);

          // Team leader invites agent
          cy.get('#members-table button span span').contains('add_box').click();
          cy.get('input[placeholder="Email"]').type(memberAgent.email);
          cy.get('button[title="Save"]').click();
          cy.wait(300);

          // Login invited agent and accept invite
          cy.login(memberAgent.email, {..._profile, name: memberAgent.name }, [this.scope.read.agents, this.scope.create.teams, this.scope.create.teamMembers]);
          cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
          cy.wait(300);

          // Login team leader
          cy.login(_profile.email, _profile, [this.scope.read.agents,
                                             this.scope.create.organizations,
                                             this.scope.read.organizations,
                                             this.scope.create.teams,
                                             this.scope.read.teams,
                                             this.scope.update.teams,
                                             this.scope.create.teamMembers,
                                             this.scope.delete.teamMembers]);

          cy.contains('The Mike Tyson Mystery Team').click();
          cy.wait(300);

          // Delete member agent
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('tr:nth-of-type(1) button[title=Delete]').click();
          cy.wait(300);
        });
      });
    });

    it('removes the correct team from the invited agent\'s interface', function() {
      cy.login(memberAgent.email, {..._profile, name: memberAgent.name }, [this.scope.read.agents, this.scope.create.teams, this.scope.create.teamMembers]);
      cy.get('#teams-table table tbody').find('tr').its('length').should('eq', 1);
      cy.get('table tbody tr td').contains('The A-Team');
    });

  });
});

export {}
