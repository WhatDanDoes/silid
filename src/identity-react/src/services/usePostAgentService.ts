import { useState } from 'react';
import { Service } from '../types/Service';
import { Agent } from '../types/Agent';

export type PostAgent = Pick<Agent, 'name' | 'email'>;

const usePostAgentService = () => {
  const [service, setService] = useState<Service<PostAgent>>({
    status: 'init',
  });

  const publishAgent = (starship: PostAgent) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch(
        'https://ixtnbvyi05.execute-api.us-east-1.amazonaws.com/dev/agent',
        {
          method: 'POST',
          body: JSON.stringify(starship),
          headers,
        }
      )
        .then(response => response.json())
        .then(response => {
          setService({ status: 'loaded', payload: response });
          resolve(response);
        })
        .catch(error => {
          setService({ status: 'error', error });
          reject(error);
        });
    });
  };

  return {
    service,
    publishAgent,
  };
};

export default usePostAgentService;
