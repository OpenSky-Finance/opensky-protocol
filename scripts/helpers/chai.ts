// @ts-ignore
import chaiModule from 'chai';
// @ts-ignore
import { chaiEthers } from 'chai-ethers';
import {chaiAlmostEqual} from './chai-almost-equal'

chaiModule.use(chaiEthers);
chaiModule.use(chaiAlmostEqual());

export = chaiModule;
