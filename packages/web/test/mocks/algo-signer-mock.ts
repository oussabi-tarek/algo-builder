/* eslint-disable sonarjs/no-identical-functions */
import {
	AlgoSigner,
	Encoding,
	JsonPayload,
	MultisigTransaction,
	RequestErrors,
	Transaction,
	WalletTransaction,
} from "../../src/algo-signer-types";

const suggestedParamsMock = {
	flatFee: false,
	"min-fee": 100,
	"first-round": 2,
	"last-round": 100,
	"genesis-id": "testnet-v1.0",
	"genesis-hash": "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
};

// refer from algo-singer
function base64ToByteArray(blob: string): Uint8Array {
	return stringToByteArray(atob(blob));
}

function byteArrayToBase64(array: any): string {
	return btoa(byteArrayToString(array));
}

function stringToByteArray(str: string): Uint8Array {
	return new Uint8Array(str.split("").map((x) => x.charCodeAt(0)));
}

function byteArrayToString(array: any): string {
	return String.fromCharCode.apply(null, array);
}

class EncodingMock implements Encoding {
	base64ToMsgpack(txn: string): Uint8Array {
		return base64ToByteArray(txn);
	}
	msgpackToBase64(txn: Uint8Array): string {
		return byteArrayToBase64(txn);
	}
}

export class AlgoSignerMock implements AlgoSigner {
	encoding: Encoding;

	constructor() {
		this.encoding = new EncodingMock();
	}

	accounts(params: JsonPayload, error?: RequestErrors): Promise<JsonPayload> {
		return new Promise((resolve, reject) => {
			return resolve({});
		});
	}

	algod(params: JsonPayload, error?: RequestErrors): Promise<JsonPayload> {
		return new Promise<JsonPayload>((resolve, reject) => {
			// return mock data
			if (params["path"] === "/v2/transactions/params") {
				resolve(suggestedParamsMock as unknown as JsonPayload);
			}
			// return infor when waiting transaction
			if ((params["path"] as string).startsWith("/v2/transactions/pending")) {
				resolve({ "confirmed-round": 1 });
			}
			resolve({});
		});
	}

	indexer(params: JsonPayload, error?: RequestErrors): Promise<JsonPayload> {
		return new Promise((resolve, reject) => {
			return resolve({});
		});
	}

	send(params: any, error?: RequestErrors): Promise<JsonPayload> {
		return new Promise((resolve, reject) => {
			return resolve({
				txId: "tx-id",
			});
		});
	}

	sign(params: Transaction, error?: RequestErrors): Promise<JsonPayload> {
		return new Promise((resolve, reject) => {
			return resolve({});
		});
	}

	signTxn(transactions: WalletTransaction[], error?: RequestErrors): Promise<JsonPayload> {
		return new Promise((resolve, reject) => {
			const result = Array(transactions.length);
			for (let txnId = 0; txnId < transactions.length; ++txnId) {
				result[txnId] = {
					txID: "tx-id",
					blob: "blod",
				};
			}
			return resolve(result as unknown as JsonPayload);
		});
	}

	signMultisig(params: MultisigTransaction, error?: RequestErrors): Promise<JsonPayload> {
		return new Promise((resolve, reject) => {
			return resolve({});
		});
	}
}
