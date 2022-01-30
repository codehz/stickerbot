import express from "express";
import renderers from "./render.js";
import * as codecs from "@astropub/codecs";

const app = express();
const port = 3000;

app.get("/g/:style/:substyle", async (req, res) => {
  const { style, substyle } = req.params;
  const { args } = req.query;
  if (Array.isArray(args) && typeof args[0] == "string") {
    const renderer = renderers[style]?.[substyle];
    if (renderer == null) {
      return res.status(404).send({ error: "style not found" });
    }
    if (args.length != renderer.inputs_count) {
      return res
        .status(400)
        .send({ error: "args length mismatch", length: renderer.inputs_count });
    }
    const canvas = renderer.render(args as string[]);
    res.setHeader("Content-Type", "image/webp");
    const buffer = canvas.toBuffer("image/png", { compressionLevel: 0 });
    const image = await codecs.decode(buffer);
    const encoded = await codecs.encode(image, "image/webp", {
      lossless: 1,
    } as any);
    res.send(Buffer.from(encoded.data));
    return;
  } else {
    return res.status(400).send({ error: "require args array" });
  }
});

app.listen(port, () => console.log(`listening on port ${port}`));
