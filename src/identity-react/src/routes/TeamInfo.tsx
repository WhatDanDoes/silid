import React, { useState, useEffect } from 'react';
import { Redirect } from 'react-router-dom';
import TextField from '@material-ui/core/TextField';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Fab from '@material-ui/core/Fab';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import Button from '@material-ui/core/Button';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import DeleteForeverOutlinedIcon from '@material-ui/icons/DeleteForeverOutlined';
import InboxIcon from '@material-ui/icons/MoveToInbox';

import { Team } from '../types/Team';
import Flash from '../components/Flash';

import { useAuthState } from '../auth/Auth';
import { useAdminState } from '../auth/Admin';

import useGetTeamInfoService from '../services/useGetTeamInfoService';
import usePutTeamService from '../services/usePutTeamService';
import useDeleteTeamService from '../services/useDeleteTeamService';
import usePutTeamMemberService from '../services/usePutTeamMemberService';
import useDeleteTeamMemberService from '../services/useDeleteTeamMemberService';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    margin: {
      margin: theme.spacing(1),
    },
    textField: {
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
      width: '100%',
    },
    [theme.breakpoints.down('sm')]: {
      card: {
        marginTop: '4%',
        maxWidth: 720,
      },
    },
    [theme.breakpoints.up('md')]: {
      card: {
        marginLeft: '25%',
        marginTop: '4%',
        maxWidth: 720,
      },
    },
  }),
);

export interface PrevFormState {
  [key:string]: any
}

const TeamInfo = (props: any) => {
  const classes = useStyles();

  const {agent} = useAuthState();
  const admin = useAdminState();

  const [editFormVisible, setEditFormVisible] = useState(false);
  const [agentFormVisible, setAgentFormVisible] = useState(false);
  const [prevFormState, setPrevFormState] = useState<PrevFormState>({});
  const [toOrganization, setToOrganization] = useState(false);
  const [flashProps, setFlashProps] = useState({} as any);

  const [teamInfo, setTeamInfo] = useState<Team>({} as Team);

  const service = useGetTeamInfoService(props.match.params.id);
  let { publishTeam } = usePutTeamService();
  let { deleteTeam } = useDeleteTeamService();
  let { putTeamMember } = usePutTeamMemberService();
  let { deleteTeamMember } = useDeleteTeamMemberService(props.match.params.id);

  useEffect(() => {
    if (service.status === 'loaded') {
      setTeamInfo(service.payload);
    }
  }, [service]);

  /**
   * Update this team
   */
  const handleSubmit = (evt:any) => {
    evt.preventDefault();

    const formData = new FormData(evt.target);
    let data = {} as Team;
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    publishTeam(data).then(results => {
      setEditFormVisible(false);
      setTeamInfo({ results, ...teamInfo } as Team);
    }).catch(err => {
      console.log(err);
    });
  }

  /**
   * Remove this team
   */
  const handleDelete = (evt:any) => {
    if (teamInfo.members.length > 1) {
      return window.alert('Remove all team members before deleting the team');
    }
    if (window.confirm('Delete team?')) {
      deleteTeam(teamInfo.id).then(results => {
        setToOrganization(true);
      });
    }
  }

  /**
   * Set tool-tip message on field validation
   */
  const customMessage = (evt:React.ChangeEvent<HTMLInputElement>) => {
    evt.target.setCustomValidity(`${evt.target.name} required`);
  }

  /**
   * Keep track of team form state
   *
   * This needs to be replaced, as it does in OrganizationInfo...
   */
  const onChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
    if (!prevFormState[evt.target.name]) {
      const s = { ...prevFormState};
      s[evt.target.name] = teamInfo[evt.target.name];
      setPrevFormState(s);
    }
    const f = { ...teamInfo };
    f[evt.target.name] = evt.target.value.trimLeft();
    setTeamInfo(f);
  }

  /**
   * Redirect to `/organization` when this team is deleted
   */
  if (toOrganization) {
    return <Redirect to={{ pathname: `/organization/${teamInfo.organizationId}`, state: 'Team deleted' }} />
  }

  /**
   * Add a new member to this team
   */
  const handleMembershipChange = (evt:any) => {
    evt.preventDefault();
    const formData = new FormData(evt.target);

    let data = {} as any;
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    putTeamMember(data).then((results: any) => {
      setAgentFormVisible(false);
      if (results.message) {
        setFlashProps({ message: results.message, variant: 'warning' });
      }
      else {
        teamInfo.members.push(results);
        setTeamInfo({ ...teamInfo } as Team);
      }
    }).catch(err => {
      console.log(err);
    });
  }

  /**
   * Remove member from team
   */
  const handleMemberDelete = (memberId: any) => {
    if (window.confirm('Remove member?')) {
      deleteTeamMember(memberId).then(results => {
        const index = teamInfo.members.findIndex(member => member.id === memberId);
        teamInfo.members.splice(index, 1);
        setTeamInfo({ ...teamInfo } as Team);
        setFlashProps({ message: 'Member removed', variant: 'success' });
      }).catch(err => {
        console.log(err);
      });
    }
  }

  function ListItemLink(props:any) {
    return <ListItem className='list-item' button component="a" {...props} />;
  }

  return (
    <div className="team">
      <Card className={classes.card}>
        <CardContent>
          <Typography variant="h5" component="h3">
            {service.status === 'loading' && <div>Loading...</div>}
            {service.status === 'loaded' ?
              <React.Fragment>
                <React.Fragment>
                  {teamInfo.name}
                </React.Fragment>
                {admin.isEnabled || (teamInfo.creator && (agent.email === teamInfo.creator.email)) ?
                  <React.Fragment>
                    {!editFormVisible ?
                      <Button id="edit-team" variant="contained" color="primary" onClick={() => setEditFormVisible(true)}>
                        Edit
                      </Button>
                    :
                      <React.Fragment>
                        <form id="edit-team-form" onSubmit={handleSubmit}>
                          <input type="hidden" name="id" value={teamInfo.id} />
                          <TextField
                            id="name-input"
                            label="Name"
                            type="text"
                            className={classes.textField}
                            InputLabelProps={{
                              shrink: true,
                            }}
                            margin="normal"
                            name="name"
                            required
                            value={teamInfo.name}
                            onChange={onChange}
                            onInvalid={customMessage}
                          />
                          <Button id="cancel-changes"
                            variant="contained" color="secondary"
                            onClick={() => {
                              setTeamInfo({ ...teamInfo, ...prevFormState });
                              setEditFormVisible(false);
                            }}>
                              Cancel
                          </Button>
                          <Button id="save-team-button"
                                  type="submit" variant="contained" color="primary"
                                  disabled={!Object.keys(prevFormState).length}>
                            Save
                          </Button>
                        </form>
                        <Button id="delete-team" variant="contained" color="secondary" onClick={handleDelete}>
                          Delete
                        </Button>
                      </React.Fragment>
                    }
                  </React.Fragment>
                : ''}
                {!editFormVisible && !agentFormVisible ?
                  <Typography variant="body2" color="textSecondary" component="p">
                    <React.Fragment>
                      {admin.isEnabled || (teamInfo.creator && (agent.email === teamInfo.creator.email)) ?
                        <Fab id="add-agent" color="primary" aria-label="add-agent" className={classes.margin}>
                          <PersonAddIcon onClick={() => setAgentFormVisible(true)} />
                        </Fab>
                      : '' }
                    </React.Fragment>
                  </Typography>
                : ''}
                {agentFormVisible ?
                  <form id="add-member-agent-form" onSubmit={handleMembershipChange}>
                    <input type="hidden" name="id" value={teamInfo.id} />
                    <TextField
                      id="email-input"
                      label="New Member Email"
                      type="email"
                      className={classes.textField}
                      InputLabelProps={{
                        shrink: true,
                      }}
                      margin="normal"
                      name="email"
                      required
                      onChange={onChange}
                      onInvalid={customMessage}
                    />
                    <Button id="cancel-add-agent"
                      variant="contained" color="secondary"
                      onClick={() => {
                        setTeamInfo({ ...teamInfo, ...prevFormState });
                        setAgentFormVisible(false);
                      }}>
                        Cancel
                    </Button>
                    <Button id="add-member-agent-button"
                            type="submit" variant="contained" color="primary"
                            disabled={!Object.keys(prevFormState).length}>
                      Add
                    </Button>
                  </form>
                : ''}

              </React.Fragment>
            : ''}
          </Typography>

          {service.status === 'loading' && <div>Loading...</div>}
          {service.status === 'loaded' && teamInfo.members && teamInfo.members.length ?
            <List id="team-member-list">
              <Typography variant="h5" component="h3">
                <React.Fragment>
                  Members
                </React.Fragment>
              </Typography>
              { teamInfo.members.map(member => (
                <ListItem button className='team-button' key={`agent-${agent.id}`}>
                  <ListItemIcon><InboxIcon /></ListItemIcon>
                  <ListItemLink href={`#agent/${member.id}`}>
                    <ListItemText primary={member.email} />
                  </ListItemLink>
                  { teamInfo.creator.email !== member.email && (agent.email === teamInfo.creator.email || admin.isEnabled) ?
                  <DeleteForeverOutlinedIcon className="delete-member" onClick={() => handleMemberDelete(member.id)} />
                  : ''}
                </ListItem>
              ))}
            </List> : ''}

          {service.status === 'error' && (
            <Typography id="error-message" variant="h5" component="h3">
              {service.error}
            </Typography>
          )}
        </CardContent>
      </Card>
      { flashProps.message ? <Flash message={flashProps.message} variant={flashProps.variant} /> : '' }
      { flashProps.errors ? flashProps.errors.map(error => <Flash message={error.message} variant={flashProps.variant} />) : '' }
    </div>
  );
};

export default TeamInfo;
