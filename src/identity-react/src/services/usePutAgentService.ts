import { useState } from 'react';
import { Service } from '../types/Service';
import { Agent } from '../types/Agent';

export type PutAgent = Pick<Agent, 'name' | 'email' | 'id'>;

const usePutAgentService = () => {
  const [service, setService] = useState<Service<PutAgent>>({
    status: 'init',
  });

  //const publishAgent = (agent: PutAgent) => {
  const publishAgent = (agent: any) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Access-Control-Allow-Credentials', 'true');
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch('/agent',
        {
          method: 'PUT',
          body: JSON.stringify(agent),
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

export default usePutAgentService;
