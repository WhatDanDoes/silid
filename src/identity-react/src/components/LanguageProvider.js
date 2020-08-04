import React from 'react';
import { useAuthState } from '../auth/Auth';

import {createIntl, createIntlCache, RawIntlProvider, IntlContext,} from 'react-intl'

/**
 * Backup Localization
 */
const defaultEnglishMessages = {
  'profile-table.header': 'Profile',
  'profile-table.name': 'Name',
  'profile-table.email': 'Email',
  'profile-table.providerLocale': 'Provider Locale',
  'profile-table.roles': 'Roles',
  'profile-table.silLocale': 'SIL Locale',
  'profile-table.silLocale.label': 'Set SIL language preference',
  'teams-table.header': 'Teams',
  'teams-table.name': 'Name',
  'teams-table.leader': 'Leader',
  'teams-table.empty': 'No records to display',
  'social-data.header': 'Social Data',
};

const cache = createIntlCache();

export function LanguageProvider({children}) {

  const {agent, isSuccess} = useAuthState();


  const [langCode, setLangCode] = React.useState(
    agent.user_metadata && agent.user_metadata.silLocale && agent.user_metadata.silLocale.iso6393 ? agent.user_metadata.silLocale.iso6393 : 'eng');

  const [intl, setIntl] = React.useState(createIntl({
                            locale: langCode,
                            defaultLocale: 'eng',
                            messages: defaultEnglishMessages
                          }, cache));


  React.useEffect(() => {
    if (isSuccess) {
      const headers = new Headers();
      headers.append('Content-Type', 'application/json; charset=utf-8');

      fetch(`/languages/${langCode}.json`, {method: 'GET', headers: headers}).then(response => {
        return response.json();
      }).then(messages => {
        if (messages.statusCode) {
          setIntl(createIntl({
            locale: langCode,
            defaultLocale: 'eng',
            messages: defaultEnglishMessages
          }, cache));
        }
        else {
          setIntl(createIntl({
            locale: langCode,
            defaultLocale: 'eng',
            messages: messages
          }, cache));
        }
      }).catch(error => {
        console.log(error);
      });
    }
  }, [langCode, isSuccess]);

  return (
    <RawIntlProvider value={{...intl, setLangCode}}>
      {children}
    </RawIntlProvider>
  );
};

export function LPFormattedMessage(props) {

  return (
    <IntlContext.Consumer>
      {context => {
        return (
          <span>{context.messages[props.id]}</span>
        )
      }}
    </IntlContext.Consumer>
  );
};

export function useLanguageProviderState() {
  const state = React.useContext(IntlContext);

  return {
    ...state,
  }
}
