const { types } = require("@algo-builder/web");
const accounts = require("../common/accounts");

async function run(runtimeEnv, deployer) {
	const controllerAppInfo = deployer.getApp("Controller");
	const controllerappID = controllerAppInfo.appID;
	const tesla = deployer.asa.get("tesla");
	const owner = deployer.accountsByName.get(accounts.owner);

	// get new permissions smart contract info
	const newPermissionsAppInfo = deployer.getApp("PermissionNewApp");

	console.log(
		`\n** Setting new permissions smart contract(id = ${newPermissionsAppInfo.appID}) **`
	);
	try {
		const appArgs = ["str:set_permission", `int:${newPermissionsAppInfo.appID}`];

		// set new permissions app id in controller smart contract
		// note: in current version, this replaces the previous appID in controller
		await deployer.executeTx([
			{
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: owner, // asa manager account
				appID: controllerappID,
				payFlags: { totalFee: 1000 },
				appArgs: appArgs,
				foreignAssets: [tesla.assetIndex], // controller smart contract verifies if correct token is being used + asa.manager is correct one
			},
		]);
	} catch (e) {
		console.log("Error occurred", e.response.error);
	}
}

module.exports = { default: run };
