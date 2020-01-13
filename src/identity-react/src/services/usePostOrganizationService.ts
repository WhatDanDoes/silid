import { useState } from 'react';
import { Service } from '../types/Service';
import { Organization } from '../types/Organization';

export type PostOrganization = Pick<Organization, 'name'>;

const usePostOrganizationService = () => {
  const [service, setService] = useState<Service<PostOrganization>>({
    status: 'init',
  });

  const publishOrganization = (organization: PostOrganization) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Authorization', `Bearer ${localStorage.getItem('accessToken')}`);
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch('/organization',
        {
          method: 'POST',
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

export default usePostOrganizationService;
