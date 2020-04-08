import React, { useState, useEffect } from 'react';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Flash from '../components/Flash';
import { useAdminState } from '../auth/Admin';

import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import Avatar from '@material-ui/core/Avatar';
import Pagination from '@material-ui/lab/Pagination';


import useGetAgentDirectoryService, { Agents } from '../services/useGetAgentDirectoryService';

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

const AgentDirectory = (props: any) => {
  const admin = useAdminState();

  const [agentList, setAgentList] = useState<Agents>({ results: [] } as Agents);
  const [flashProps, setFlashProps] = useState({} as any);

  const classes = useStyles();
  const service = useGetAgentDirectoryService(admin.viewingCached);

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

  function ListItemLink(props:any) {
    return <ListItem className='list-item' button component="a" {...props} />;
  }

  return (
    <div className="agent-directory">
      <Card className={classes.card}>
        <CardContent>
          <Typography variant="h5" component="h3">
            Directory
          </Typography>
          <Typography variant="body2" color="textSecondary" component="div">
          {service.status === 'loading' && <div>Loading...</div>}
          {service.status === 'loaded' && agentList.results.length ?
            <>
              { agentList.results.length >= 30 ?
                <Pagination className="pager" count={-1} size="large" />
              : ''}
              <List id="agent-list">
                { agentList.results.map(a => (
                  <ListItem className='agent-button' key={`Agents-${admin.viewingCached ? a.id : a.user_id}`}>
                    <ListItemLink href={`#agent/${admin.viewingCached ? a.id : a.user_id}`}>
                      <ListItemAvatar>
                        <Avatar className="avatar" alt={a.name} src={a.picture} />
                      </ListItemAvatar>
                      <ListItemText className="name-email" primary={a.name} secondary={a.email} />
                    </ListItemLink>
                  </ListItem>
                ))}
              </List>
              { agentList.results.length >= 30 ?
                <Pagination className="pager" count={-1} size="large" />
              : ''}
            </> : ''}
          </Typography>
          {service.status === 'error' && (
            <div>Error, the backend moved to the dark side.</div>
          )}
        </CardContent>
      </Card>
      { flashProps.message ? <Flash message={flashProps.message} variant={flashProps.variant} /> : '' }
      { flashProps.errors ? flashProps.errors.map((error, index) => <Flash message={error.message} variant={flashProps.variant} key={`flash-${index}`} />) : '' }
    </div>
  );
};

export default AgentDirectory;
