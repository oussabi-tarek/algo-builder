import { bobAcc } from "@algo-builder/algob/test/mocks/account";
import { decodeAddress, getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { AccountStore, getProgram, Interpreter, Runtime } from "../../../src";
import RUNTIME_ERRORS from "../../../src/errors/errors-list";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../../src/lib/constants";
import { Stack } from "../../../src/lib/stack";
import { AccountAddress, AccountStoreI, ExecutionMode, StackElem } from "../../../src/types";
import { useFixture } from "../../helpers/integration";
import { expectRuntimeError } from "../../helpers/runtime-errors";
import { elonMuskAccount, johnAccount } from "../../mocks/account";
import { accInfo } from "../../mocks/stateful";
import { elonAddr, TXN_OBJ } from "../../mocks/txn";

export function setDummyAccInfo(acc: AccountStoreI): void {
	acc.appsLocalState = accInfo[0].appsLocalState;
	acc.appsTotalSchema = accInfo[0].appsTotalSchema;
	acc.createdApps = accInfo[0].createdApps;
}

describe("Interpreter", function () {
	let interpreter: Interpreter;
	let elonAcc: AccountStoreI;
	let johnAcc: AccountStoreI;
	let bobAccount: AccountStoreI;
	let appAccAddr: AccountAddress;
	let applicationAccount: AccountStoreI;
	const elonPk = decodeAddress(elonAddr).publicKey;

	const resetInterpreterState = (): void => {
		while (interpreter.stack.length() !== 0) {
			interpreter.stack.pop();
		}
		interpreter.currentInnerTxnGroup = [];
		interpreter.runtime.ctx.pooledApplCost = 0;
		interpreter.instructions = [];
		interpreter.innerTxnGroups = [];
		interpreter.instructionIndex = 0;
		interpreter.runtime.ctx.tx = { ...TXN_OBJ, snd: Buffer.from(elonPk) };
		interpreter.runtime.ctx.gtxs = [interpreter.runtime.ctx.tx];
		interpreter.runtime.ctx.isInnerTx = false;
		// set new tx receipt
		interpreter.runtime.ctx.state.txReceipts.set(TXN_OBJ.txID, {
			txn: TXN_OBJ,
			txID: TXN_OBJ.txID,
		});
		interpreter.tealVersion = 1;
	};

	const setUpInterpreter = (
		tealVersion: number,
		appBalance: number = ALGORAND_ACCOUNT_MIN_BALANCE
	): void => {
		// setup 1st account (to be used as sender)
		elonAcc = new AccountStore(0, elonMuskAccount); // setup test account
		setDummyAccInfo(elonAcc);

		// setup 2nd account
		johnAcc = new AccountStore(0, johnAccount);

		// setup 3rd account
		bobAccount = new AccountStore(1000000, bobAcc);

		// setup application account
		appAccAddr = getApplicationAddress(TXN_OBJ.apid);
		applicationAccount = new AccountStore(appBalance, {
			addr: appAccAddr,
			sk: new Uint8Array(0),
		});

		interpreter = new Interpreter();
		interpreter.runtime = new Runtime([elonAcc, johnAcc, bobAccount, applicationAccount]);
		interpreter.tealVersion = tealVersion;
		resetInterpreterState();
	};
	this.beforeAll(() => {
		setUpInterpreter(6); //setup interpreter for execute
	});

	describe("Teal cost", () => {
		useFixture("teal-files");
		beforeEach(() => {
			resetInterpreterState(); //resetInterpreterState the state of interpreter
			interpreter.cost = 0;
		});

		it("Should return correct cost for a simple .teal program ", () => {
			const file = "test-file-1.teal";
			interpreter.execute(getProgram(file), ExecutionMode.SIGNATURE, interpreter.runtime);
			assert.equal(interpreter.cost, 3);
		});

		it("Should return correct cost for a simple .teal program ", () => {
			const file = "test-file-3.teal";
			interpreter.execute(getProgram(file), ExecutionMode.SIGNATURE, interpreter.runtime);
			assert.equal(interpreter.cost, 3);
		});

		it("Should return correct cost for a .teal program(if-else)", () => {
			const file = "test-if-else.teal";
			interpreter.execute(getProgram(file), ExecutionMode.SIGNATURE, interpreter.runtime);
			assert.equal(interpreter.cost, 9);
		});

		it("Should return correct cost for a .teal program with different version(v1)", () => {
			const file = "test-sha256-v1.teal";
			interpreter.execute(getProgram(file), ExecutionMode.SIGNATURE, interpreter.runtime);
			assert.equal(interpreter.cost, 14);
		});

		it("Should return correct cost for a .teal program for different version(v2)", () => {
			const file = "test-sha256-v2.teal";
			interpreter.execute(getProgram(file), ExecutionMode.SIGNATURE, interpreter.runtime);
			assert.equal(interpreter.cost, 42);
		});

		it("Should fail when executing wrong logic teal", () => {
			// logic of teal file failed
			const file = "test-label.teal";
			expectRuntimeError(
				() =>
					interpreter.execute(getProgram(file), ExecutionMode.SIGNATURE, interpreter.runtime),
				RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
			);
		});
	});
});
