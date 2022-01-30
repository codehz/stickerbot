import { readFileSync } from "fs";
import YAML from "yaml";

export interface TextStyle {
  color: string;
  font?: string;
  linethrough?: number;
  underline?: number
}

export type ComponentConfigMap = {
  text: {
    value: string;
  } & TextStyle;
  reftext: {
    ref: number;
  } & TextStyle;
  fill: {
    color: string;
  };
};

export type ComponentConfig = {
  [K in keyof ComponentConfigMap]: { type: K } & ComponentConfigMap[K];
}[keyof ComponentConfigMap];

export type SubStyle = {
  preview?: string;
  inputs: number;
  components: Record<string, ComponentConfig>;
  layout: string;
};

export type Config = {
  font: string;
  styles: Record<string, Record<string, SubStyle>>;
};

export default YAML.parse(readFileSync("./config.yaml").toString()) as Config;
