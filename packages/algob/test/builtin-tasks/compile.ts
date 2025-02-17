import { PyCompileOp } from "@algo-builder/runtime";
import { Algodv2 } from "algosdk";
import { assert } from "chai";
import chalk from "chalk";
import * as fs from "fs";
import * as murmurhash from "murmurhash";
import * as path from "path";
import YAML from "yaml";

import { compile } from "../../src/builtin-tasks/compile";
import { ASSETS_DIR } from "../../src/internal/core/project-structure";
import { CompileOp } from "../../src/lib/compile";
import type { ASCCache, SCParams } from "../../src/types";
import { useFixtureProjectCopy } from "../helpers/project";

interface CompileIn {
	filename: string;
	tealHash: number;
}

class CompileOpMock extends CompileOp {
	timestamp = 0;
	compiledFiles = [] as CompileIn[];
	writtenFiles = [] as string[];

	async compile(
		filename: string,
		_tealCode: string,
		tealHash: number,
		scParams: SCParams
	): Promise<ASCCache> {
		this.compiledFiles.push({ filename, tealHash });
		this.timestamp++;
		return {
			filename: filename,
			timestamp: this.timestamp,
			compiled: "compiled",
			compiledHash: "compiledHash",
			srcHash: tealHash,
			tealCode: _tealCode,
			base64ToBytes: new Uint8Array(1),
			scParams: scParams,
		};
	}

	writeFile(filename: string, _content: string): void {
		this.writtenFiles.push(filename);
		super.writeFile(filename, _content);
	}

	resetAndCompile(force: boolean): Promise<void> {
		this.compiledFiles = [];
		this.writtenFiles = [];
		return compile(force, this);
	}
}

describe("Compile task", () => {
	useFixtureProjectCopy("config-project");
	const fakeAlgod: Algodv2 = {} as Algodv2; // eslint-disable-line @typescript-eslint/consistent-type-assertions
	const op = new CompileOpMock(fakeAlgod);

	const cacheDir = path.join("artifacts", "cache");
	const f1 = "asc-fee-check.copy.teal";
	const f2 = "asc-fee-check.teal";
	const f3PY = "gold-asa.py";
	const f4 = "gold-asa.teal";
	const fhash = 2374470440; // murmur3 hash for f1 file

	const scTmplParam = {
		bob: "2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ",
		alice: "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
		hash_image: "QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=",
	};

	before(function () {
		const isRoot = process.getuid && process.getuid() === 0;
		if (isRoot) {
			const warnMsg =
				chalk.yellowBright(`*** If running tests as root, make sure to have pyteal installed in sudo env (or install pyteal as root).
      Otherwise below tests will fail ***`);
			console.warn(warnMsg);
		}
	});

	it("on first run it should compile all .teal sources", async () => {
		await op.resetAndCompile(false);

		assert.equal(op.timestamp, 4);
		assert.deepEqual(op.compiledFiles, [
			{ filename: f1, tealHash: fhash },
			{ filename: f2, tealHash: fhash },
			{ filename: f3PY, tealHash: 2014712600 },
			{ filename: f4, tealHash: 1625384743 },
		]);

		const writtenFiles = [];
		for (const fn of [f1, f2, f3PY, f4]) {
			const fullF = path.join(cacheDir, fn + ".yaml");
			writtenFiles.push(fullF);
			assert.isTrue(fs.existsSync(fullF));
		}
		assert.deepEqual(op.writtenFiles, writtenFiles);
	});

	it("shouldn't recompile when files didn't change", async () => {
		await op.resetAndCompile(false);

		assert.equal(op.timestamp, 4);
		assert.lengthOf(op.compiledFiles, 0);
		assert.lengthOf(op.writtenFiles, 0);
	});

	it("should recompile only changed files", async () => {
		const content = "// comment";
		fs.writeFileSync(path.join(ASSETS_DIR, f2), content);
		await op.resetAndCompile(false);

		assert.equal(op.timestamp, 5);
		assert.deepEqual(op.compiledFiles, [{ filename: f2, tealHash: murmurhash.v3(content) }]);
		assert.deepEqual(op.writtenFiles, [path.join(cacheDir, f2 + ".yaml")]);
	});

	it("should recompile all files when --force is used", async () => {
		await op.resetAndCompile(true);

		assert.equal(op.timestamp, 9);
		assert.lengthOf(op.compiledFiles, 4);
		assert.lengthOf(op.writtenFiles, 4);
	});

	it("should return TEAL code", async () => {
		const pyOp = new PyCompileOp();
		const content = fs.readFileSync(path.join(ASSETS_DIR, f4), "utf8");
		const res = pyOp.compilePyTeal(f3PY) + "\n"; // eslint-disable-line @typescript-eslint/restrict-plus-operands
		assert.deepEqual(content.toString(), res);
	});

	it("should return correct ASCCache from CompileOp", async () => {
		const result = await op.ensureCompiled(f3PY, "", true, scTmplParam);
		const expected = fs.readFileSync(path.join(ASSETS_DIR, "gold-asa-py-check.yaml"), "utf8");
		assert.isDefined(result.scParams);
		assert.deepEqual(YAML.stringify(result), expected);
	});
});

describe("Support External Parameters in PyTEAL program", () => {
	useFixtureProjectCopy("support-external-parameters");
	const fakeAlgod: Algodv2 = {} as Algodv2; // eslint-disable-line @typescript-eslint/consistent-type-assertions
	const op = new CompileOpMock(fakeAlgod);

	const cacheDir = path.join("artifacts", "cache");
	const stateless = "stateless.py";
	const stateful = "stateful.py";
	let statelessHash = 0;
	let statefulHash = 0;

	const scInitParam = {
		ARG_SENDER: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
		ASSET_AMOUNT: 1000n,
	};

	it("PyTEAL code test", async () => {
		// On first run, should compile pyTEAL code
		let result = await op.ensureCompiled(stateless);
		statelessHash = result.srcHash;

		result = await op.ensureCompiled(stateful);
		statefulHash = result.srcHash;

		let writtenFiles = [];
		for (const fn of [stateless, stateful]) {
			const fullF = path.join(cacheDir, fn + ".yaml");
			writtenFiles.push(fullF);
			assert.isTrue(fs.existsSync(fullF));
		}

		assert.equal(op.timestamp, 2);
		assert.deepEqual(op.writtenFiles, writtenFiles);

		// On second run, shouln't recompile because No external parameters passed
		await op.resetAndCompile(false);

		// timestamp didn't change because file is not recompiled
		assert.equal(op.timestamp, 2);
		assert.lengthOf(op.compiledFiles, 0);
		assert.lengthOf(op.writtenFiles, 0);

		// On third run, should compile on third run because external parameters passed
		result = await op.ensureCompiled(stateless, "", false, scInitParam);
		const newStatelessHash = result.srcHash;
		// Different Hash because external parameters are passed
		// and they are different than initial parameters
		console.log(statelessHash, newStatelessHash);

		result = await op.ensureCompiled(stateful, "", false, scInitParam);

		writtenFiles = [];
		for (const fn of [stateless, stateful]) {
			const fullF = path.join(cacheDir, fn + ".yaml");
			writtenFiles.push(fullF);
			assert.isTrue(fs.existsSync(fullF));
		}
		// timestamp changed
		assert.equal(op.timestamp, 4);
		assert.deepEqual(op.writtenFiles, writtenFiles);
		// new hash should be different than initial hash
		assert.notEqual(statelessHash, newStatelessHash);
		assert.notEqual(statefulHash, result.srcHash);
	});
});

describe("Support TMPL Placeholder Parameters in PyTEAL program", () => {
	useFixtureProjectCopy("support-tmpl-parameters");
	const fakeAlgod: Algodv2 = {} as Algodv2; // eslint-disable-line @typescript-eslint/consistent-type-assertions
	const op = new CompileOpMock(fakeAlgod);

	const stateless = "stateless.py";
	const stateful = "stateful.py";

	it("Should replace TMPL_ placeholders in TEAL file", async () => {
		const scTmplParam = {
			TMPL_SENDER: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
			TMPL_AMOUNT: 1000n,
		};

		const result = await op.ensureCompiled(stateless, "", false, scTmplParam);

		const expected = fs.readFileSync("expected-stateless.teal", "utf-8");
		assert.equal(result.tealCode, expected);
	});

	it("PyTEAL TMPL + External parameters test", async () => {
		const scTmplParam = {
			ARG_SENDER: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
			TMPL_AMOUNT: 100n,
		};

		const result = await op.ensureCompiled(stateful, "", false, scTmplParam);

		const expected = fs.readFileSync("expected-stateful.teal", "utf-8");
		assert.equal(result.tealCode, expected);
	});
});
