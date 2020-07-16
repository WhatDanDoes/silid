import { useState } from 'react';
import { Service } from '../types/Service';
import { Organization } from '../types/Organization';

export type PutOrganization = Pick<Organization, 'name' | 'id'>;

const usePutOrganizationService = () => {
  const [service, setService] = useState<Service<PutOrganization>>({
    status: 'init',
  });

  const publishOrganization = (organization: any) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch(`/organization/${organization.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(organization),
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
    publishOrganization,
  };
};

export default usePutOrganizationService;
