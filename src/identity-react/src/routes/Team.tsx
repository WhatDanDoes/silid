import React, { useState, useEffect } from 'react';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Fab from '@material-ui/core/Fab';
import AddIcon from '@material-ui/icons/Add';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Button from '@material-ui/core/Button';
import Flash from '../components/Flash';
import TeamCreateForm from '../components/TeamCreateForm';
// Remove this junk later
import InboxIcon from '@material-ui/icons/MoveToInbox';

import useGetTeamService, { Teams } from '../services/useGetTeamService';

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
    card: {
      marginLeft: '25%',
      marginTop: '4%',
      maxWidth: 720,
    },
  }),
);

const Team = (props: any) => {
  const [formVisible, toggleFormVisible] = useState(false);
  const [teamList, setTeamList] = useState<Teams>({ results: [] } as Teams);
  const [flashProps, setFlashProps] = useState({} as any);

  const classes = useStyles();
  const service = useGetTeamService();

  useEffect(() => {
    if (service.status === 'loaded') {
      setTeamList(service.payload);
    }
  }, [service]);

  function ListItemLink(props:any) {
    return <ListItem className='list-item' button component="a" {...props} />;
  }

  return (
    <div className="team">
      <Card className={classes.card}>
        <CardContent>
          <Typography variant="h5" component="h3">
            Teams
          </Typography>
          { props.location.state ? <Flash message={props.location.state} variant="success" /> : '' }
          { flashProps.errors ? flashProps.errors.map(error => <Flash message={error.message} variant={flashProps.variant} />) : '' }
          { formVisible ?
              <React.Fragment>
                <TeamCreateForm
                  done={(results) => {
                    toggleFormVisible(false);
                    if (results.errors) {
                      setFlashProps({errors: results.errors, variant: 'error' });
                    }
                    else {
                      setTeamList({ results: [results, ...teamList.results] } as Teams);
                    }
                  }}/>
                <Button id="cancel-changes"
                  variant="contained" color="secondary"
                  onClick={() => {
                    toggleFormVisible(false)
                  }}>
                    Cancel
                </Button>
              </React.Fragment>
            :
              <Fab id="add-team" color="secondary" aria-label="add" className={classes.margin}>
                <AddIcon onClick={() => toggleFormVisible(true)} />
              </Fab>
          }

          <Typography variant="body2" color="textSecondary" component="p">
          {service.status === 'loading' && <div>Loading...</div>}
          {service.status === 'loaded' && teamList.results.length ?
            <List id="team-list">
              { teamList.results.map(team => (
                <ListItem button className='team-button' key='Teams'>
                  <ListItemIcon><InboxIcon /></ListItemIcon>
                  <ListItemLink href={`#team/${team.id}`}>
                    <ListItemText primary={team.name} />
                  </ListItemLink>
                </ListItem>
              ))}
            </List> : ''}
          {service.status === 'error' && (
            <div>Error, the backend moved to the dark side.</div>
          )}
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
};

export default Team;
