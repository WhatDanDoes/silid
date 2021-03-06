import React from 'react';
import { useAuthState } from '../auth/Auth';

import {createIntl, createIntlCache, RawIntlProvider, IntlContext} from 'react-intl'

const cache = createIntlCache();

export function LanguageProvider({children}) {

  const {agent, isSuccess} = useAuthState();


  const [langCode, setLangCode] = React.useState(
    agent.user_metadata && agent.user_metadata.silLocale && agent.user_metadata.silLocale.iso6393 ? agent.user_metadata.silLocale.iso6393 : 'eng');

  const [intl, setIntl] = React.useState(createIntl({
                            locale: langCode,
                            defaultLocale: agent.providerLocale || 'eng',
                          }, cache));

  React.useEffect(() => {
    if (isSuccess) {
      const headers = new Headers();
      headers.append('Content-Type', 'application/json; charset=utf-8');

      fetch(`/languages/${langCode}.json`, {method: 'GET', headers: headers}).then(response => {
        if (!response.ok) {
          throw new Error('Language file could not be retrieved');
        }
        return response.json();
      }).then(messages => {
        setIntl(createIntl({
          locale: langCode,
          defaultLocale: agent.providerLocale,
          messages: messages
        }, cache));
      }).catch(error => {
        console.log(error);
      });
    }
  }, [langCode, isSuccess, agent.providerLocale]);

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
          <span>{context.messages[props.id] || props.id}</span>
        )
      }}
    </IntlContext.Consumer>
  );
};

export function useLanguageProviderState() {
  const state = React.useContext(IntlContext);

  return {
    ...state,
    getFormattedMessage: (id, obj, def) => {
      if (obj && state.messages[id]) {
        return state.formatMessage({ id: id }, obj);
      }
      else if (obj && def) {
        return state.formatMessage({ id: def, defaultMessage: def }, obj);
      }
      return state.messages[id] || id
    }
  };
};
