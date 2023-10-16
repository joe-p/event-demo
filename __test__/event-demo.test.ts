import {
  describe, test, expect, beforeAll, beforeEach,
} from '@jest/globals';
import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk from 'algosdk';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as base32 from 'hi-base32';
import { EventDemoClient } from '../contracts/clients/EventDemoClient';

const fixture = algorandFixture();

let appClient: EventDemoClient;

function getLogs(txns: any, logs: string[]) {
  txns.forEach((t: any) => {
    logs.push(...t.dt.lg);

    if (t.dt.itx) getLogs(t.dt.itx, logs);
  });
}

describe('EventDemo', () => {
  beforeEach(fixture.beforeEach);

  beforeAll(async () => {
    await fixture.beforeEach();
    const { algod, testAccount } = fixture.context;
    const sender = algosdk.generateAccount();

    appClient = new EventDemoClient(
      {
        sender: testAccount,
        resolveBy: 'id',
        id: 0,
      },
      algod,
    );

    await appClient.create.createApplication({});

    await appClient.appClient.fundAppAccount(algokit.microAlgos(200_000));
  });

  test('event', async () => {
    await appClient.outer({}, { sendParams: { fee: algokit.microAlgos(2000) } });

    const lastRound = (await fixture.context.algod.status().do())['last-round'];

    const block = await fixture.context.algod.block(lastRound).do();
    const logs: string[] = [];
    getLogs(block.block.txns, logs);

    console.log(logs);
  });
});
