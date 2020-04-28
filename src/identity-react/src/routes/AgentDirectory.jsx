import React, { useState, useEffect } from 'react';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Flash from '../components/Flash';
import { useAdminState } from '../auth/Admin';

import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import Avatar from '@material-ui/core/Avatar';
import Pagination from '@material-ui/lab/Pagination';

import Grid from '@material-ui/core/Grid';

import useGetAgentDirectoryService from '../services/useGetAgentDirectoryService';

const useStyles = makeStyles((theme) =>
  createStyles({
    root: {
      flexGrow: 1,
    },
    header: {
      marginTop: '1em',
      marginBottom: '1em',
    },
    grid: {
      width: '90%',
    },
  }),
);

const AgentDirectory = (props) => {
  const admin = useAdminState();

  const [agentList, setAgentList] = useState({ results: [] });
  const [flashProps, setFlashProps] = useState({});

  const classes = useStyles();

  /**
   * Pager handler
   */
  const [page, setPage] = useState(1);
  const handlePage = (event, value) => {
    setPage(value);
  }

  const service = useGetAgentDirectoryService(page, admin.viewingCached);
  useEffect(() => {
    if (service.status === 'loaded') {

      if (service.payload.message) {
        setFlashProps({ message: service.payload.message, variant: 'error' });
      }
      else {
        setAgentList(service.payload);
      }
    }
  }, [service]);

  function ListItemLink(props) {
    return <ListItem className='list-item' button component="a" {...props} />;
  }

  return (
    <div className={classes.root}>
      <Grid container direction="column" justify="center" alignItems="center">
        <Grid item>
          <Typography className={classes.header} variant="h5" component="h3">
            Directory
          </Typography>
        </Grid>
        <Grid item>
          {service.status === 'loading' && <div>Loading...</div>}
          {service.status === 'loaded' && agentList.results.length ?
            <>
              { agentList.results.length < agentList.results.total ?
                <Pagination className="pager" page={page} count={Math.ceil(agentList.results.total / agentList.results.limit)} size="large" onChange={handlePage} />
              : ''}
              <List id="agent-list">
                { agentList.results.users.map(a => (
                  <ListItem className='agent-button' key={`Agents-${a.user_id}`}>
                    <ListItemLink href={`#agent/${a.user_id}`}>
                      <ListItemAvatar>
                        <Avatar className="avatar" alt={a.name} src={a.picture} />
                      </ListItemAvatar>
                      <ListItemText className="name-email" primary={a.name} secondary={a.email} />
                    </ListItemLink>
                  </ListItem>
                ))}
              </List>
              { agentList.results.length < agentList.results.total ?
                <Pagination className="pager" page={page} count={Math.ceil(agentList.results.total / agentList.results.limit)} size="large" onChange={handlePage} />
              : ''}
            </> : ''}
          {service.status === 'error' && (
            <div>Error, the backend moved to the dark side.</div>
          )}
        </Grid>
      </Grid>
      { flashProps.message ? <Flash message={flashProps.message} variant={flashProps.variant} /> : '' }
      { flashProps.errors ? flashProps.errors.map((error, index) => <Flash message={error.message} variant={flashProps.variant} key={`flash-${index}`} />) : '' }
    </div>
  );
};

export default AgentDirectory;
