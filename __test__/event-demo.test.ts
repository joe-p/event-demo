import {
  describe, test, expect, beforeAll, beforeEach,
} from '@jest/globals';
import * as algokit from '@algorandfoundation/algokit-utils';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import algosdk from 'algosdk';
import { EventDemoClient } from '../contracts/clients/EventDemoClient';

const fixture = algorandFixture();

let appClient: EventDemoClient;

type AppLogs = {appID: BigInt, logs: string[], txID: string};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLogs(txns: any, logs: AppLogs[], genesisHash: Uint8Array, transactionID?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txns.forEach((t: any) => {
    let txID = transactionID;
    if (txID === undefined) {
      // eslint-disable-next-line no-param-reassign
      t.txn.gh = genesisHash;

      txID = algosdk.Transaction.from_obj_for_encoding(t.txn).txID();
    }
    logs.push({ appID: BigInt(t.txn.apid || 0), logs: t.dt.lg, txID });

    if (t.dt.itx) getLogs(t.dt.itx, logs, genesisHash, txID);
  });
}

describe('EventDemo', () => {
  beforeEach(fixture.beforeEach);

  beforeAll(async () => {
    await fixture.beforeEach();
    const { algod, testAccount } = fixture.context;

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
    const logs: AppLogs[] = [];

    getLogs(block.block.txns, logs, block.block.gh);

    expect(logs[0].appID).toBeGreaterThan(BigInt(0));
    expect(logs[0].logs).toEqual(['outer called']);
    expect(logs[1].appID).toBe(BigInt(0));
    expect(logs[1].logs).toEqual(['inner created']);
    expect(logs[0].txID).toEqual(logs[1].txID);
  });
});
