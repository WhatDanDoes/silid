import { useState } from 'react';
import { Service } from '../types/Service';
import { Organization } from '../types/Organization';

export type DeleteOrganization = Pick<Organization, 'id'>;

const useDeleteOrganizationService = () => {
  const [service, setService] = useState<Service<DeleteOrganization>>({
    status: 'init',
  });

  const deleteOrganization = (organization: any) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch('/organization',
        {
          method: 'DELETE',
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
    deleteOrganization,
  };
};

export default useDeleteOrganizationService;
