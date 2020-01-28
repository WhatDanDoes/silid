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
import MailIcon from '@material-ui/icons/Mail';
import Avatar from '@material-ui/core/Avatar';
import Grid from '@material-ui/core/Grid';
import { useAuthState, AuthContext } from '../auth/Auth';

interface IProps {
  logout: any;
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: { flexGrow: 1,
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
  })
);

const Home = (props: IProps) => {
  //const { auth } = props;
  const {agent} = useAuthState();
  const state = React.useContext(AuthContext)

  const classes = useStyles();

  const [drawerPosition, setDrawerPosition] = React.useState({
    left: false,
  });

//  const [authenticated, setAuthenticated] = React.useState(false);
//  const [profile, setProfile] = React.useState({} as any);


  function ListItemLink(props: any) {
    return <ListItem button component="a" {...props} />;
  }

  type DrawerSide = 'left';
  const toggleDrawer = (side: DrawerSide, open: boolean) => (
    event: React.KeyboardEvent | React.MouseEvent
  ) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
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
        {['Home', 'Personal Info'].map((text, index) => (
          <ListItem button key={text}>
            <ListItemIcon>
              {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
            </ListItemIcon>
            <ListItemLink href={index === 1 ? '#agent' : '#/'}>
              <ListItemText primary={text} />
            </ListItemLink>
          </ListItem>
        ))}
        <ListItem button id='organization-button' key='Organizations'>
          <ListItemIcon><InboxIcon /></ListItemIcon>
          <ListItemLink href='#organization'>
            <ListItemText primary='Organizations' />
          </ListItemLink>
        </ListItem>
      </List>
      <Divider />
      <List>
        {['Help'].map((text, index) => (
          <ListItem button key={text}>
            <ListItemIcon>
              {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
            </ListItemIcon>
            <ListItemText primary={text} />
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <AppBar position="static">
      <Toolbar>
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
        <Typography variant="h6" className={classes.title}>
          Identity
        </Typography>

        {!agent && (
          <Button
            id="login-button"
            color="inherit"
            onClick={() => {
            }}
          >
            Login
          </Button>
        )}
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
              onClick={() => {
                console.log('logout');
                const headers = new Headers();
                fetch('/logout', {method: 'GET', headers: headers, credentials: 'include', mode: 'no-cors' }).then(response => {
                   return response.text();
                }).then(profile => {
                  props.logout();
                }).catch(error => {
                  console.log('Logout', error);
                  props.logout();
                });
              }}
            >
              Logout
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

//            onClick={() => window.location.href = `${process.env.REACT_APP_API_URL}/login`}

//          <ListItem button id='login-link' key='login'>
//            <ListItemLink href='/login'>
//              <ListItemText primary='Login' />
//            </ListItemLink>
//          </ListItem>

//          <Button
//            id="login-button"
//            color="inherit"
//            onClick={() => auth.login()}
//          >
//            Login
//          </Button>

export default Home;
