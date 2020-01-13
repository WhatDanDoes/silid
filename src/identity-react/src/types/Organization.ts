import { Agent } from './Agent';

export interface Organization {
  [key:string]: any,
  id: number;
  name: string;
  creator: Agent;
}
