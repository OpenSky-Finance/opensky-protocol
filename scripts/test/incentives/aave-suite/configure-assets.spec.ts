const { expect } = require('chai');

import { _makeSuite } from './_make-suite';
import { RANDOM_ADDRESSES } from '../helpers/constants';
import { increaseTime, waitForTx, getBlockTimestamp } from '../../../helpers/utils';
import { CompareRules, eventChecker } from '../helpers/comparator-engine';
import {
  AssetData,
  assetDataComparator,
  AssetUpdateData,
  getAssetsData,
} from './data-helpers/asset-data';
import { BigNumberish } from '@ethersproject/bignumber';

type ScenarioAction = {
  caseName: string;
  customTimeMovement?: number;
  assets: Omit<AssetUpdateData, 'underlyingAsset'>[];
  compareRules?: CompareRules<AssetUpdateData, AssetData>;
};

const configureAssetScenarios: ScenarioAction[] = [
  {
    caseName: 'Submit initial config for the assets',
    assets: [
      {
        emissionPerSecond: '11',
        totalStaked: '0',
      },
    ],
    compareRules: {
      fieldsEqualToInput: ['emissionPerSecond'],
    },
  },
  {
    caseName: 'Submit updated config for the assets',
    assets: [
      {
        emissionPerSecond: '33',
        totalStaked: '0',
      },
      {
        emissionPerSecond: '22',
        totalStaked: '0',
      },
    ],
    compareRules: {
      fieldsEqualToInput: ['emissionPerSecond'],
    },
  },
  {
    caseName:
      'Indexes should change if emission are set not to 0, and pool has deposited and borrowed funds',
    assets: [
      {
        emissionPerSecond: '33',
        totalStaked: '100000',
      },
      {
        emissionPerSecond: '22',
        totalStaked: '123123123',
      },
    ],
    compareRules: {
      fieldsEqualToInput: ['emissionPerSecond'],
    },
  },
  {
    caseName: 'Indexes should cumulate rewards if next emission is 0',
    assets: [
      {
        emissionPerSecond: '0',
        totalStaked: '100000',
      },
    ],
    compareRules: {
      fieldsEqualToInput: ['emissionPerSecond'],
    },
  },
  {
    caseName: 'Indexes should not change if no emission',
    assets: [
      {
        emissionPerSecond: '222',
        totalStaked: '213213213213',
      },
    ],
    compareRules: {
      fieldsEqualToInput: ['emissionPerSecond'],
    },
  },
  {
    caseName: 'Should go to the limit if distribution ended',
    customTimeMovement: 1000 * 60 * 100,
    assets: [
      {
        emissionPerSecond: '222',
        totalStaked: '213213213213',
      },
    ],
    compareRules: {
      fieldsEqualToInput: ['emissionPerSecond'],
    },
  },
  {
    caseName: 'Should not accrue any rewards after end or distribution',
    customTimeMovement: 1000,
    assets: [
      {
        emissionPerSecond: '222',
        totalStaked: '213213213213',
      },
    ],
    compareRules: {
      fieldsEqualToInput: ['emissionPerSecond'],
    },
  },
];

_makeSuite('pullRewardsIncentivesController configureAssets', (testEnv: any) => {
  let deployedAssets:any;

  before(async () => {
    deployedAssets = [testEnv.aWETH, testEnv.aDAI];
  });

  // custom checks
  it('Tries to submit config updates not from emission manager', async () => {
    const { pullRewardsIncentivesController, user001 } = testEnv;
    await expect(
      pullRewardsIncentivesController.connect(user001.signer).configureAssets([], [])
    ).to.be.revertedWith('ONLY_EMISSION_MANAGER');
  });

  for (const {
    assets: assetsConfig,
    caseName,
    compareRules,
    customTimeMovement,
  } of configureAssetScenarios) {
    it(caseName, async () => {
      const { pullRewardsIncentivesController } = testEnv;
      const distributionEndTimestamp = await pullRewardsIncentivesController.DISTRIBUTION_END();

      const assets: string[] = [];
      const assetsEmissions: BigNumberish[] = [];
      const assetConfigsUpdate: AssetUpdateData[] = [];

      for (let i = 0; i < assetsConfig.length; i++) {
        const { emissionPerSecond, totalStaked } = assetsConfig[i];
        if (i > deployedAssets.length) {
          throw new Error('to many assets to test');
        }

        // Change current supply
        await deployedAssets[i].setUserBalanceAndSupply('0', totalStaked);

        // Push configs
        assets.push(deployedAssets[i].address);
        assetsEmissions.push(emissionPerSecond);
        assetConfigsUpdate.push({
          emissionPerSecond,
          totalStaked,
          underlyingAsset: deployedAssets[i].address,
        });
      }

      const assetsConfigBefore = await getAssetsData(pullRewardsIncentivesController, assets);

      if (customTimeMovement) {
        await increaseTime(customTimeMovement);
      }

      const txReceipt = await waitForTx(
        await pullRewardsIncentivesController.configureAssets(assets, assetsEmissions)
      );
      const configsUpdateBlockTimestamp = await getBlockTimestamp(txReceipt.blockNumber);
      const assetsConfigAfter = await getAssetsData(pullRewardsIncentivesController, assets);

      const eventsEmitted = txReceipt.events || [];

      let eventArrayIndex = 0;
      for (let i = 0; i < assetsConfigBefore.length; i++) {
        const assetConfigBefore = assetsConfigBefore[i];
        const assetConfigUpdateInput = assetConfigsUpdate[i];
        const assetConfigAfter = assetsConfigAfter[i];

        if (!assetConfigAfter.index.eq(assetConfigBefore.index)) {
          eventChecker(eventsEmitted[eventArrayIndex], 'AssetIndexUpdated', [
            assetConfigAfter.underlyingAsset,
            assetConfigAfter.index,
          ]);
          eventArrayIndex += 1;
        }

        eventChecker(eventsEmitted[eventArrayIndex], 'AssetConfigUpdated', [
          assetConfigAfter.underlyingAsset,
          assetConfigAfter.emissionPerSecond,
        ]);
        eventArrayIndex += 1;

        await assetDataComparator(
          assetConfigUpdateInput,
          assetConfigBefore,
          assetConfigAfter,
          configsUpdateBlockTimestamp,
          distributionEndTimestamp.toNumber(),
          compareRules || {}
        );
      }
      expect(eventsEmitted[eventArrayIndex]).to.be.equal(undefined, 'Too many events emitted');
    });
  }
});