import React from 'react';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import Typography from '@material-ui/core/Typography';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import List from '@material-ui/core/List';
import Divider from '@material-ui/core/Divider';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import InboxIcon from '@material-ui/icons/MoveToInbox';
import Avatar from '@material-ui/core/Avatar';
import Grid from '@material-ui/core/Grid';
import { useAuthState } from '../auth/Auth';
import { useAdminState } from '../auth/Admin';

import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';

import { useLanguageProviderState, LPFormattedMessage as FormattedMessage} from '../components/LanguageProvider';

interface IProps {
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1,
    },
    menuButton: {
      marginRight: theme.spacing(2),
    },
    title: {
      flexGrow: 1,
    },
    link: {
      margin: theme.spacing(1),
    },
    list: {
      width: 250,
    },
    fullList: {
      width: 'auto',
    },
    avatar: {
      margin: 10,
    },
    bigAvatar: {
      margin: 10,
      width: 60,
      height: 60,
    },
    homeLink: {
      textDecoration: 'none',
      color: 'white',
      '&:hover': {
        textDecoration: 'underline',
      }
    }
  })
);

const Home = (props: IProps) => {
  const {agent, logout} = useAuthState();

  const classes = useStyles();

  const { getFormattedMessage } = useLanguageProviderState();

  /**
   * Admin toggle
   */
  const admin = useAdminState();
  const toggleAdminMode = (event) => {
    setDrawerPosition({ ...drawerPosition, left: true });
    admin.toggleMode();
  };

  /**
   * Menu link
   */
  function ListItemLink(props: any) {
    return <ListItem button component="a" {...props} />;
  }

  /**
   * Menu drawer
   */
  const [drawerPosition, setDrawerPosition] = React.useState({
    left: false,
  });

  type DrawerSide = 'left';
  const toggleDrawer = (side: DrawerSide, open: boolean) => (
    event: React.KeyboardEvent | React.MouseEvent
  ) => {
    if (
      event.type === 'keydown' &&
      (event.key === 'Tab' || event.key === 'Shift')
    ) {
      return;
    }
    setDrawerPosition({ ...drawerPosition, [side]: open });
  };

  const sideList = (side: DrawerSide) => (
    <div
      id="app-menu"
      className={classes.list}
      role="presentation"
      onClick={toggleDrawer(side, false)}
      onKeyDown={toggleDrawer(side, false)}
    >
      <List>
        <ListItem button id='agent-button' key='Agents'>
          <ListItemIcon><InboxIcon /></ListItemIcon>
          <ListItemLink href='#agent'>
            <ListItemText primary={getFormattedMessage('Profile')} />
          </ListItemLink>
        </ListItem>
        {agent.isSuper && (
          <ListItem button key='Admin'>
            <FormControlLabel
              control={
                <Switch id='admin-switch' checked={admin.isEnabled} onChange={toggleAdminMode} value="admin" />
              }
              label={getFormattedMessage('Admin Mode')}
            />
          </ListItem>
        )}
        {(admin.isEnabled || agent.isOrganizer) && (
          <>
            <ListItem button id='directory-button' key='Directory'>
              <ListItemIcon><InboxIcon /></ListItemIcon>
              <ListItemLink href='#agent/admin'>
                <ListItemText primary={getFormattedMessage('Agent Directory')} />
              </ListItemLink>
            </ListItem>
          </>
        )}
      </List>
      <Divider />
    </div>
  );

  return (
    <AppBar position="static">
      <Toolbar>
        {(agent.isSuper || agent.isOrganizer) && (
          <>
            <IconButton
              id="app-menu-button"
              onClick={toggleDrawer('left', true)}
              edge="start"
              className={classes.menuButton}
              color="inherit"
              aria-label="menu">
              <MenuIcon />
            </IconButton>
            <Drawer open={drawerPosition.left} onClose={toggleDrawer('left', false)}>
              {sideList('left')}
            </Drawer>
          </>
        )}
        <Typography variant="h6" className={classes.title}>
          <a className={classes.homeLink} href="/"><FormattedMessage id='Identity' /></a>
        </Typography>

        {agent && (
          <>
            <Grid container justify="flex-end" alignItems="flex-start">
              {agent.picture ? (
                <Avatar
                  alt="avatar"
                  src={agent.picture}
                  className={classes.avatar}
                />
              ) : (
                <div></div>
            )}
            </Grid>
            <Button
              id="logout-button"
              color="inherit"
              onClick={logout}
            >
              <FormattedMessage id='Logout' />
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Home;
