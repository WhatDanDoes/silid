import { useState } from 'react';
import { Service } from '../types/Service';

export type PutOrganizationMember = Pick<any, 'id' | 'email'>;

const usePutOrganizationMemberService = () => {
  const [service, setService] = useState<Service<PutOrganizationMember>>({
    status: 'init',
  });

  const putOrganizationMember = (update: any) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch(`/organization/${update.id}/agent`,
        {
          method: 'PUT',
          body: JSON.stringify(update),
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
    putOrganizationMember,
  };
};

export default usePutOrganizationMemberService;
