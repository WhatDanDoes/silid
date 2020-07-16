context('organizer/Team show', function() {

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

  describe('authenticated', () => {

    let organizationId, teamId, agent, leader;
    beforeEach(() => {
      organizationId = 'some-organization-uuid-v4';
      teamId = 'some-team-uuid-v4';

      // Team leader
      cy.login('coach@example.com', {..._profile, name: 'Curt Malawsky',
                                      user_metadata: {
                                        teams: [
                                          {
                                            id: 'some-team-uuid-v4',
                                            name: 'The Calgary Roughnecks',
                                            leader: 'coach@example.com',
                                            organizationId: organizationId,
                                          }
                                        ]
                                      }
                                    });

      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='coach@example.com' LIMIT 1;`).then(([results, metadata]) => {
        leader = results[0];

        // Organizer agent
        cy.login(_profile.email, _profile);
  
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
    
          // The '123' role ID matches that defined in the RBAC mock server
          cy.request('POST', `https://localhost:3002/api/v2/users/${agent.socialProfile.user_id}/roles`, { roles: ['123'] });
  
          cy.login(_profile.email, {..._profile, user_metadata: {
                                                   organizations: [
                                                     {
                                                       id: organizationId,
                                                       name: 'The National Lacrosse League',
                                                       organizer: _profile.email,
                                                     }
                                                   ]
                                                 } });
  
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            agent = results[0];
          });
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    });

    context('visit by organizer', () => {
      beforeEach(() => {
        cy.visit('/#/agent');
        cy.wait(300);
        cy.contains('The National Lacrosse League').click();
        cy.wait(300);
        cy.contains('The Calgary Roughnecks').click();
        cy.wait(300);
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${teamId}`);
      });

      it('displays appropriate Team interface elements', () => {
        cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 4);
        cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', leader.socialProfile.user_metadata.teams[0].name);
        cy.get('#team-profile-info tbody tr td').contains(leader.email);
        cy.get('#team-profile-info tbody tr:nth-of-type(3) td a')
          .should('contain', agent.socialProfile.user_metadata.organizations[0].name)
          .and('have.attr', 'href')
          .and('equal', `#organization/${agent.socialProfile.user_metadata.organizations[0].id}`);
        cy.get('#team-profile-info #add-team-to-organization').should('exist');
        cy.get('button#delete-team').should('not.exist');
        cy.get('button#save-team').should('not.exist');
        cy.get('button#cancel-team-changes').should('not.exist');
      });
    });

    context('visit by leader of member team', () => {

      beforeEach(() => {
        // Membership established in first `beforeEach`
        cy.login('coach@example.com', {..._profile, name: 'Curt Malawsky'});
        cy.contains('The Calgary Roughnecks').click();
        cy.wait(300);
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${teamId}`);
      });

      it('displays appropriate Team interface elements', () => {
        cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
        cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
        cy.get('#team-profile-info tbody tr td input#team-name-field').should('not.be.disabled');
        cy.get('#team-profile-info tbody tr td').contains(leader.email);
        cy.get('#team-profile-info tbody tr:nth-of-type(3) td a')
          .should('contain', agent.socialProfile.user_metadata.organizations[0].name)
          .and('have.attr', 'href')
          .and('equal', `#organization/${agent.socialProfile.user_metadata.organizations[0].id}`);
        cy.get('button#delete-team').should('exist');
        cy.get('button#save-team').should('not.exist');
        cy.get('button#cancel-team-changes').should('not.exist');
      });
    });


    context('visit by member of member team', () => {

      beforeEach(() => {
        // Team player
        cy.login('player@example.com', {..._profile, name: 'Tracey Kelusky',
                                        user_metadata: {
                                          teams: [
                                            {
                                              id: 'some-team-uuid-v4',
                                              name: 'The Calgary Roughnecks',
                                              leader: 'coach@example.com',
                                              organizationId: organizationId,
                                            }
                                          ]
                                        }
                                      });
        cy.contains('The Calgary Roughnecks').click();
        cy.wait(300);
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${teamId}`);
      });

      it('displays appropriate Team interface elements', () => {
        cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
        cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
        cy.get('#team-profile-info tbody tr td input#team-name-field').should('be.disabled');
        cy.get('#team-profile-info tbody tr td').contains(leader.email);
        cy.get('#team-profile-info tbody tr:nth-of-type(3) td a')
          .should('contain', agent.socialProfile.user_metadata.organizations[0].name)
          .and('have.attr', 'href')
          .and('equal', `#organization/${agent.socialProfile.user_metadata.organizations[0].id}`);
        cy.get('button#delete-team').should('not.exist');
        cy.get('button#save-team').should('not.exist');
        cy.get('button#cancel-team-changes').should('not.exist');
      });
    });
  });
});

export {}
