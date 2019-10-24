import common from "rollup-plugin-commonjs";
import pkg from "./package.json";
import resolve from "rollup-plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";

export default {
  input: "src/index.ts",
  output: [
    {
      file: pkg.main,
      format: "esm"
    }
  ],

  plugins: [
    common(),
    resolve(),
    typescript({
      typescript: require("typescript")
    })
  ]
};
