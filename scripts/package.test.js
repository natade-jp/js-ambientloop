import NTFile from "ntfile";

const jest_config_js = {
	verbose: true,
	rootDir: "./src",
	moduleFileExtensions: ["js", "mjs"],
	/**
	 * @type {string[]}
	 */
	testMatch: [],
	transform: {
		"^.+\\.(js|mjs)$": "babel-jest"
	}
};

if (process.argv[2]) {
	const test_file_name = process.argv[2];
	jest_config_js.testMatch.push("**/?(*.)" + test_file_name + ".test.?(m)js");
} else {
	jest_config_js.testMatch.push("**/__tests__/**/*.?(m)js?(x)");
	jest_config_js.testMatch.push("**/?(*.)(spec|test).?(m)js?(x)");
}

NTFile.saveTextFile("jest.config.js", "module.exports = " + JSON.stringify(jest_config_js) + ";");

NTFile.exec("npx jest");

NTFile.deleteFile("jest.config.js");
