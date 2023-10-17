import {
  describe, test, expect, beforeAll, beforeEach,
} from '@jest/globals';
import * as algokit from '@algorandfoundation/algokit-utils';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import algosdk from 'algosdk';
import { PendingTransactionResponse } from 'algosdk/dist/types/client/v2/algod/models/types';
import { sha512_256 } from 'js-sha512';
import { EventDemoClient } from '../contracts/clients/EventDemoClient';

const fixture = algorandFixture();

let appClient: EventDemoClient;

type AppLogs = {appID: bigint, logs: Uint8Array[], txID: string};

function getLogsFromBlock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txns: any,
  logs: AppLogs[],
  genesisHash: Uint8Array,
  transactionID?: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txns.forEach((t: any) => {
    let txID = transactionID;
    if (txID === undefined) {
      // eslint-disable-next-line no-param-reassign
      t.txn.gh = genesisHash;

      // TODO: determine correct txID (this is wrong)
      txID = algosdk.Transaction.from_obj_for_encoding(t.txn).txID();
    }
    logs.push({
      // TODO: determine created app ID
      appID: BigInt(t.txn.apid || 0),
      logs: t.dt.lg.map((l: string) => new Uint8Array(Buffer.from(l))),
      txID,
    });

    if (t.dt.itx) getLogsFromBlock(t.dt.itx, logs, genesisHash, txID);
  });
}

function getLogsFromPendingTxns(
  ptxns: PendingTransactionResponse[],
  logs: AppLogs[],
  txnID?: string,
) {
  ptxns.forEach((t) => {
    const txID = txnID || algosdk.Transaction.from_obj_for_encoding(t.txn.txn).txID();
    logs.push({
      appID: BigInt(t.applicationIndex || t.txn.txn.apid!),
      logs: t.logs || [],
      txID,
    });

    if (t.innerTxns) {
      getLogsFromPendingTxns(t.innerTxns, logs, txID);
    }
  });
}

function getEventFromLogs(event: string, logs: AppLogs[]) {
  const selector = sha512_256(event).slice(0, 8);

  const events: {appID: bigint, txID: string, args: Uint8Array}[] = [];
  logs.forEach((l) => l.logs.forEach((log) => {
    const hexLog = Buffer.from(log).toString('hex');
    if (hexLog.startsWith(selector)) {
      events.push({
        appID: l.appID,
        txID: l.txID,
        args: log.slice(4),
      });
    }
  }));

  return events;
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

  test('logParsing', async () => {
    const outerLog = 'this is a regular outer log';
    const innerLog = 'this is a regular inner log';

    const { appId } = await appClient.appClient.getAppReference();

    const result = await appClient.outer({}, { sendParams: { fee: algokit.microAlgos(2000) } });

    const txnLogs: AppLogs[] = [];

    getLogsFromPendingTxns(result.confirmations!, txnLogs);

    expect(txnLogs[0].appID).toEqual(BigInt(appId));
    expect(Buffer.from(txnLogs[0].logs[0]).toString()).toEqual(outerLog);
    expect(txnLogs[1].appID).toBeGreaterThan(txnLogs[0].appID);
    expect(Buffer.from(txnLogs[1].logs[0]).toString()).toEqual(innerLog);
    expect(txnLogs[0].txID).toEqual(txnLogs[1].txID);

    const lastRound = (await fixture.context.algod.status().do())['last-round'];

    const block = await fixture.context.algod.block(lastRound).do();

    const blockLogs: AppLogs[] = [];

    getLogsFromBlock(block.block.txns, blockLogs, block.block.gh);

    expect(blockLogs[0].appID).toEqual(BigInt(appId));
    expect(Buffer.from(blockLogs[0].logs[0]).toString()).toEqual(outerLog);
    expect(blockLogs[1].appID).toEqual(BigInt(0));
    expect(Buffer.from(blockLogs[1].logs[0]).toString()).toEqual(innerLog);
    expect(blockLogs[0].txID).toEqual(blockLogs[1].txID);

    const outterEvent = getEventFromLogs('outterEvent(string)', txnLogs);
    const innerEvent = getEventFromLogs('innerEvent(string)', txnLogs);

    expect(outterEvent.length).toEqual(1);
    expect(innerEvent.length).toEqual(1);
    expect(Buffer.from(outterEvent[0].args).toString()).toEqual('this is an outer event log');
    expect(Buffer.from(innerEvent[0].args).toString()).toEqual('this is an inner event log');
  });
});
