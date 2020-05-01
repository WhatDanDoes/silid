import React, { useState, useEffect } from 'react';
import { Redirect } from 'react-router-dom';
//import TextField from '@material-ui/core/TextField';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
//import Card from '@material-ui/core/Card';
//import CardContent from '@material-ui/core/CardContent';
//import Fab from '@material-ui/core/Fab';
//import PersonAddIcon from '@material-ui/icons/PersonAdd';
import Button from '@material-ui/core/Button';
//import List from '@material-ui/core/List';
//import ListItem from '@material-ui/core/ListItem';
//import ListItemIcon from '@material-ui/core/ListItemIcon';
//import ListItemText from '@material-ui/core/ListItemText';
//import DeleteForeverOutlinedIcon from '@material-ui/icons/DeleteForeverOutlined';
//import InboxIcon from '@material-ui/icons/MoveToInbox';

import Grid from '@material-ui/core/Grid';

import Flash from '../components/Flash';

//import { useAuthState } from '../auth/Auth';
//import { useAdminState } from '../auth/Admin';

import useGetTeamInfoService from '../services/useGetTeamInfoService';
import usePutTeamService from '../services/usePutTeamService';
import useDeleteTeamService from '../services/useDeleteTeamService';
//import usePutTeamMemberService from '../services/usePutTeamMemberService';
//import useDeleteTeamMemberService from '../services/useDeleteTeamMemberService';

/**
 * For profile data display
 */
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import MaterialTable from 'material-table';

import Link from '@material-ui/core/Link';

const useStyles = makeStyles((theme) =>
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


const TeamInfo = (props) => {
  const classes = useStyles();

//  const {agent} = useAuthState();
//  const admin = useAdminState();

//  const [editFormVisible, setEditFormVisible] = useState(false);
//  const [agentFormVisible, setAgentFormVisible] = useState(false);
  const [prevInputState, setPrevInputState] = useState({});
  const [toAgent, setToAgent] = useState(false);
  const [flashProps, setFlashProps] = useState({});

  const [teamInfo, setTeamInfo] = useState({});

  const service = useGetTeamInfoService(props.match.params.id);
  let { publishTeam } = usePutTeamService();
  let { deleteTeam } = useDeleteTeamService();
//  let { putTeamMember } = usePutTeamMemberService();
//  let { deleteTeamMember } = useDeleteTeamMemberService(props.match.params.id);

  useEffect(() => {
    if (service.status === 'loaded') {
      setTeamInfo(service.payload);
    }
  }, [service]);

  /**
   * Update this team
   */
  const handleUpdate = (evt) => {
    // Front-end validation (sufficient for now...)
    if (!teamInfo.name.trim()) {
      return setFlashProps({ message: 'Team name can\'t be blank', variant: 'error' });
    }

    publishTeam({...teamInfo, members: undefined, tableData: undefined}).then(results => {
      if (results.statusCode) {
        setFlashProps({ message: results.message, variant: 'error' });
      }
      else if (results.errors) {
        setFlashProps({...results, variant: 'error' });
      }
      else {
        setPrevInputState({});
        setTeamInfo(results);
        setFlashProps({ message: 'Team updated', variant: 'success' });
      }
    }).catch(err => {
      console.log(err);
    });
  }

  /**
   * Remove this team
   */
  const handleDelete = (evt) => {
    if (teamInfo.members.length > 1) {
      return window.alert('Remove all team members before deleting the team');
    }
    if (window.confirm('Delete team?')) {
      deleteTeam(teamInfo.id).then(results => {
        if (results.statusCode) {
          setFlashProps({ message: results.message, variant: 'error' });
        }
        else {
          setToAgent(true);
        }
      }).catch(err => {
        console.log('TeamInfo Error');
        console.log(err);
      });
    }
  }

  /**
   * Set tool-tip message on field validation
   */
//  const customMessage = (evt) => {
//    evt.target.setCustomValidity(`${evt.target.name} required`);
//  }

  /**
   * Keep track of team form state
   *
   * This needs to be replaced, as it does in OrganizationInfo...
   */
//  const onChange = (evt) => {
//    if (!prevFormState[evt.target.name]) {
//      const s = { ...prevFormState};
//      s[evt.target.name] = teamInfo[evt.target.name];
//      setPrevFormState(s);
//    }
//    const f = { ...teamInfo };
//    f[evt.target.name] = evt.target.value.trimLeft();
//    setTeamInfo(f);
//  }

  /**
   * Redirect to `/agent` when this team is deleted
   */
  if (toAgent) {
    return <Redirect to={{ pathname: `/agent`, state: 'Team deleted' }} />
  }

  /**
   * Add a new member to this team
   */
//  const handleMembershipChange = (evt) => {
//    evt.preventDefault();
//    const formData = new FormData(evt.target);
//
//    let data = {};
//    for (const [key, value] of formData.entries()) {
//      data[key] = value;
//    }
//
//    putTeamMember(data).then((results) => {
//      setAgentFormVisible(false);
//      if (results.message) {
//        setFlashProps({ message: results.message, variant: 'warning' });
//      }
//      else {
//        teamInfo.members.push(results);
//        setTeamInfo({ ...teamInfo });
//      }
//    }).catch(err => {
//      console.log(err);
//    });
//  }

  /**
   * Remove member from team
   */
//  const handleMemberDelete = (memberId) => {
//    if (window.confirm('Remove member?')) {
//      deleteTeamMember(memberId).then(results => {
//        const index = teamInfo.members.findIndex(member => member.id === memberId);
//        teamInfo.members.splice(index, 1);
//        setTeamInfo({ ...teamInfo });
//        setFlashProps({ message: 'Member removed', variant: 'success' });
//      }).catch(err => {
//        console.log(err);
//      });
//    }
//  }

//  function ListItemLink(props) {
//    return <ListItem className='list-item' button component="a" {...props} />;
//  }

  return (
    <div className={classes.root}>
      <Grid container direction="column" justify="center" alignItems="center">
        <Grid item>
          <Typography variant="body2" color="textSecondary" component="p">
            {service.status === 'loading' && <span>Loading...</span>}
          </Typography>
        </Grid>
        {service.status === 'loaded' && service.payload ?
          <>
            <Grid item>
              <Typography className={classes.header} variant="h5" component="h3">
                Team
              </Typography>
            </Grid>
            <Grid item className={classes.grid}>
              <TableContainer component={Paper}>
                <Table className={classes.table} aria-label="Team profile info">
                  <TableBody>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row">Name:</TableCell>
                      <TableCell  lign="left">
                        <input id="team-name-field" value={teamInfo.name || ''}
                          onChange={e => {
                              if (!prevInputState.name) {
                                setPrevInputState({ name: teamInfo.name });
                              }
                              setTeamInfo({ ...teamInfo, name: e.target.value });
                            }
                          } />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row">Email:</TableCell>
                      <TableCell align="left">{teamInfo.leader}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item className={classes.grid}>
              <TableContainer>
                <Table className={classes.table} aria-label="Team delete and edit buttons">
                  <TableBody>
                    <TableRow>
                      { Object.keys(prevInputState).length ?
                        <>
                          <TableCell align="right">
                            <Button id="cancel-team-changes" variant="contained" color="secondary"
                                    onClick={e => {
                                      setTeamInfo({ ...teamInfo, ...prevInputState });
                                      setPrevInputState({});
                                    }
                            }>
                              Cancel
                            </Button>
                          </TableCell>
                          <TableCell align="left">
                            <Button id="save-team" variant="contained" color="primary" onClick={handleUpdate}>
                              Save
                            </Button>
                          </TableCell>
                        </>
                      :
                        <TableCell align="left">
                          <Button id="delete-team" variant="contained" color="secondary" onClick={handleDelete}>
                            Delete
                          </Button>
                        </TableCell>
                      }
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            <Grid item className={classes.grid}>
              <MaterialTable
                title='Members'
                columns={[
                  { title: 'Name', field: 'name', render: rowData => <Link href={`#agent/${rowData.user_id}`}>{rowData.name}</Link> },
                  { title: 'Email', field: 'email'}
                ]}
                data={teamInfo.members ? teamInfo.members : []}
                options={{ search: false, paging: false }}
              />
            </Grid>
          </>
        : ''}
        {service.status === 'error' && (
          <Typography id="error-message" variant="h5" component="h3">
            {service.error}
          </Typography>
        )}
      </Grid>

      { flashProps.message ? <Flash message={flashProps.message} onClose={() => setFlashProps({})} variant={flashProps.variant} /> : '' }
      { flashProps.errors ? flashProps.errors.map(error => <Flash message={error.message}
                                                                  onClose={() => setFlashProps({})}
                                                                  variant={flashProps.variant}
                                                                  key={`error-${error.message}`} />) : '' }
    </div>
  );
};


//  return (
//    <div className="team">
//      <Card className={classes.card}>
//        <CardContent>
//          <Typography variant="h5" component="h3">
//            {service.status === 'loading' && <div>Loading...</div>}
//            {service.status === 'loaded' ?
//              <React.Fragment>
//                <React.Fragment>
//                  {teamInfo.name}
//                </React.Fragment>
//                {admin.isEnabled || (teamInfo.creator && (agent.email === teamInfo.creator.email)) ?
//                  <React.Fragment>
//                    {!editFormVisible ?
//                      <Button id="edit-team" variant="contained" color="primary" onClick={() => setEditFormVisible(true)}>
//                        Edit
//                      </Button>
//                    :
//                      <React.Fragment>
//                        <form id="edit-team-form" onSubmit={handleSubmit}>
//                          <input type="hidden" name="id" value={teamInfo.id} />
//                          <TextField
//                            id="name-input"
//                            label="Name"
//                            type="text"
//                            className={classes.textField}
//                            InputLabelProps={{
//                              shrink: true,
//                            }}
//                            margin="normal"
//                            name="name"
//                            required
//                            value={teamInfo.name}
//                            onChange={onChange}
//                            onInvalid={customMessage}
//                          />
//                          <Button id="cancel-changes"
//                            variant="contained" color="secondary"
//                            onClick={() => {
//                              setTeamInfo({ ...teamInfo, ...prevFormState });
//                              setEditFormVisible(false);
//                            }}>
//                              Cancel
//                          </Button>
//                          <Button id="save-team-button"
//                                  type="submit" variant="contained" color="primary"
//                                  disabled={!Object.keys(prevFormState).length}>
//                            Save
//                          </Button>
//                        </form>
//                        <Button id="delete-team" variant="contained" color="secondary" onClick={handleDelete}>
//                          Delete
//                        </Button>
//                      </React.Fragment>
//                    }
//                  </React.Fragment>
//                : ''}
//                {!editFormVisible && !agentFormVisible ?
//                  <Typography variant="body2" color="textSecondary" component="p">
//                    <React.Fragment>
//                      {admin.isEnabled || (teamInfo.creator && (agent.email === teamInfo.creator.email)) ?
//                        <Fab id="add-agent" color="primary" aria-label="add-agent" className={classes.margin}>
//                          <PersonAddIcon onClick={() => setAgentFormVisible(true)} />
//                        </Fab>
//                      : '' }
//                    </React.Fragment>
//                  </Typography>
//                : ''}
//                {agentFormVisible ?
//                  <form id="add-member-agent-form" onSubmit={handleMembershipChange}>
//                    <input type="hidden" name="id" value={teamInfo.id} />
//                    <TextField
//                      id="email-input"
//                      label="New Member Email"
//                      type="email"
//                      className={classes.textField}
//                      InputLabelProps={{
//                        shrink: true,
//                      }}
//                      margin="normal"
//                      name="email"
//                      required
//                      onChange={onChange}
//                      onInvalid={customMessage}
//                    />
//                    <Button id="cancel-add-agent"
//                      variant="contained" color="secondary"
//                      onClick={() => {
//                        setTeamInfo({ ...teamInfo, ...prevFormState });
//                        setAgentFormVisible(false);
//                      }}>
//                        Cancel
//                    </Button>
//                    <Button id="add-member-agent-button"
//                            type="submit" variant="contained" color="primary"
//                            disabled={!Object.keys(prevFormState).length}>
//                      Add
//                    </Button>
//                  </form>
//                : ''}
//
//              </React.Fragment>
//            : ''}
//          </Typography>
//
//          {service.status === 'loading' && <div>Loading...</div>}
//          {service.status === 'loaded' && teamInfo.members && teamInfo.members.length ?
//            <List id="team-member-list">
//              <Typography variant="h5" component="h3">
//                <React.Fragment>
//                  Members
//                </React.Fragment>
//              </Typography>
//              { teamInfo.members.map(member => (
//                <ListItem button className='team-button' key={`agent-${agent.id}`}>
//                  <ListItemIcon><InboxIcon /></ListItemIcon>
//                  <ListItemLink href={`#agent/${member.id}`}>
//                    <ListItemText primary={member.email} />
//                  </ListItemLink>
//                  { teamInfo.creator.email !== member.email && (agent.email === teamInfo.creator.email || admin.isEnabled) ?
//                  <DeleteForeverOutlinedIcon className="delete-member" onClick={() => handleMemberDelete(member.id)} />
//                  : ''}
//                </ListItem>
//              ))}
//            </List> : ''}
//
//          {service.status === 'error' && (
//            <Typography id="error-message" variant="h5" component="h3">
//              {service.error}
//            </Typography>
//          )}
//        </CardContent>
//      </Card>
//      { flashProps.message ? <Flash message={flashProps.message} variant={flashProps.variant} /> : '' }
//      { flashProps.errors ? flashProps.errors.map(error => <Flash message={error.message} variant={flashProps.variant} />) : '' }
//    </div>
//  );

export default TeamInfo;
