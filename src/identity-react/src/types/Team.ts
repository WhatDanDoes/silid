import { Agent } from './Agent';

export interface Team {
  [key:string]: any,
  id: number;
  name: string;
  creator: Agent;
}
