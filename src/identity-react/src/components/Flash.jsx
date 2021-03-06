/**
 * 2019-12-17
 * 
 * Straight up jacked from https://material-ui.com/components/snackbars/
 */
import React, { SyntheticEvent } from 'react';
import clsx from 'clsx';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import InfoIcon from '@material-ui/icons/Info';
import CloseIcon from '@material-ui/icons/Close';
import { amber, green } from '@material-ui/core/colors';
import IconButton from '@material-ui/core/IconButton';
import Snackbar from '@material-ui/core/Snackbar';
import SnackbarContent from '@material-ui/core/SnackbarContent';
import WarningIcon from '@material-ui/icons/Warning';
import { makeStyles, Theme } from '@material-ui/core/styles';

const variantIcon = {
  success: CheckCircleIcon,
  warning: WarningIcon,
  error: ErrorIcon,
  info: InfoIcon,
};

const useStyles1 = makeStyles((theme: Theme) => ({
  success: {
    backgroundColor: green[600],
  },
  error: {
    backgroundColor: theme.palette.error.dark,
  },
  info: {
    backgroundColor: theme.palette.primary.main,
  },
  warning: {
    backgroundColor: amber[700],
  },
  icon: {
    fontSize: 20,
  },
  iconVariant: {
    opacity: 0.9,
    marginRight: theme.spacing(1),
  },
  message: {
    display: 'flex',
    alignItems: 'center',
  },
}));

export interface Props {
  className?: string;
  message?: string;
  onClose?: () => void;
  variant: keyof;
}

function Flash(props: Props) {
  const classes = useStyles1();
  const { className, message, onClose, variant, ...other } = props;
  const Icon = variantIcon[variant];
  const [open, setOpen] = React.useState(true);

  const handleClose = (event?: SyntheticEvent, reason?: string) => {
    if (onClose) {
      onClose();
    }
    if (reason === 'clickaway') {
      return;
    }

    setOpen(false);
  };

  return (
    <Snackbar
      id="flash-message"
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      open={open}
      autoHideDuration={6000}
      onClose={handleClose}
    >
      <SnackbarContent
        className={clsx(classes[variant], className)}
        aria-describedby="client-snackbar"
        message={
          <span id="client-snackbar" className={classes.message}>
            <Icon className={clsx(classes.icon, classes.iconVariant)} />
            {message}
          </span>
        }
        action={[
          <IconButton id="close-flash" key="close" aria-label="close" color="inherit" onClick={handleClose}>
            <CloseIcon className={classes.icon} />
          </IconButton>,
        ]}
        {...other}
      />
    </Snackbar>
  );
}

export default Flash;

//const useStyles2 = makeStyles((theme: Theme) => ({
//  margin: {
//    margin: theme.spacing(1),
//  },
//}));
//
//export default function CustomizedSnackbars() {
//  const classes = useStyles2();
//  const [open, setOpen] = React.useState(false);
//
//  const handleClick = () => {
//    setOpen(true);
//  };
//
//  const handleClose = (event?: SyntheticEvent, reason?: string) => {
//    if (reason === 'clickaway') {
//      return;
//    }
//
//    setOpen(false);
//  };
//
//  return (
//    <div>
//      <Button variant="outlined" className={classes.margin} onClick={handleClick}>
//        Open success snackbar
//      </Button>
//      <Snackbar
//        anchorOrigin={{
//          vertical: 'bottom',
//          horizontal: 'left',
//        }}
//        open={open}
//        autoHideDuration={6000}
//        onClose={handleClose}
//      >
//        <MySnackbarContentWrapper
//          onClose={handleClose}
//          variant="success"
//          message="This is a success message!"
//        />
//      </Snackbar>
//      <MySnackbarContentWrapper
//        variant="error"
//        className={classes.margin}
//        message="This is an error message!"
//      />
//      <MySnackbarContentWrapper
//        variant="warning"
//        className={classes.margin}
//        message="This is a warning message!"
//      />
//      <MySnackbarContentWrapper
//        variant="info"
//        className={classes.margin}
//        message="This is an information message!"
//      />
//      <MySnackbarContentWrapper
//        variant="success"
//        className={classes.margin}
//        message="This is a success message!"
//      />
//    </div>
//  );
//}
