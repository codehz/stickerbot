import { readFileSync } from "fs";
import YAML from "yaml";

type Secret = {
  token: string;
}

export default YAML.parse(readFileSync("./secret.yaml").toString()) as Secret;
