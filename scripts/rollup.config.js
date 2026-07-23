import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";

/**
 * 公開用ファイルの設定データを作成
 * @param {string} moduleName - ライブラリ名
 * @param {string} input_name - 入力となるES6のライブラリのトップファイル名
 * @param {string} output_name - 出力するファイル名
 * @param {string} format - umd, cjs, esm
 * @param {boolean} isUglify - コードを最小化させるか否か
 */
const createData = function (moduleName, input_name, output_name, format, isUglify) {
	const data = {};
	data.output = {};
	data.output.name = moduleName;
	data.output.file = output_name;
	data.output.format = format;
	data.input = input_name;
	/**
	 * @type {import("rollup").Plugin[]}
	 */
	data.plugins = [];

	data.plugins.push(resolve()); // node_modules を解決
	data.plugins.push(commonjs()); // CommonJS を解決

	if (isUglify) {
		data.plugins.push(terser());
	}

	return data;
};

const name = "ambientloop";
const input = "./public/src/app.js";
const data = [];

data.push(createData(name, input, "./public/js/app.min.js", "esm", true));

export default data;
