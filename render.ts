import config, { TextStyle } from "./config.js";
import type { SubStyle, ComponentConfigMap } from "./config.js";
import { Canvas, CanvasRenderingContext2D } from "canvas";
import AutoLayout from "@lume/autolayout";

const dummy = new Canvas(1, 1).getContext("2d");
dummy.font = config.font;

type RenderFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) => void;

interface ComponentInstance {
  readonly size?: Record<"width" | "height", number>;
  readonly render: RenderFn;
}

type Component = (inputs: string[]) => ComponentInstance;

type ComponentBuilder<X extends keyof ComponentConfigMap> = (
  cfg: ComponentConfigMap[X]
) => Component;

type Measured = Record<"width" | "height" | "fix", number>;

const measure = (text: string, font: string = config.font): Measured => {
  dummy.font = font;
  const metrics = dummy.measureText(text);
  const width = metrics.width;
  const height = metrics.actualBoundingBoxAscent;
  return { width, height, fix: metrics.actualBoundingBoxDescent };
};

const renderText = (
  text: string,
  { font = config.font, color, linethrough, underline }: TextStyle
): ComponentInstance => {
  const measured = measure(text, font);
  return {
    size: measured,
    render(ctx, x, y) {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y + measured.height - ((measured.fix / 2) | 0));
      if (linethrough != null) {
        ctx.strokeStyle = color;
        ctx.lineWidth = linethrough;
        const hy = ((y + measured.height / 2) | 0) - linethrough / 2;
        ctx.beginPath();
        ctx.lineTo(x, hy);
        ctx.lineTo(x + measured.width, hy);
        ctx.stroke();
      }
      if (underline != null) {
        ctx.strokeStyle = color;
        ctx.lineWidth = underline;
        const hy = ((y + measured.height) | 0) - underline / 2;
        ctx.beginPath();
        ctx.lineTo(x, hy);
        ctx.lineTo(x + measured.width, hy);
        ctx.stroke();
      }
    },
  };
};

const component_builders: {
  [K in keyof ComponentConfigMap]: ComponentBuilder<K>;
} = {
  text:
    ({ value, ...styles }) =>
    () =>
      renderText(value, styles),
  reftext:
    ({ ref, ...styles }) =>
    (inputs) => {
      const text = inputs[ref];
      if (text == null) {
        throw new Error("out of range");
      }
      return renderText(text, styles);
    },
  fill:
    ({ color }) =>
    () => ({
      render(ctx, x, y, w, h) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
      },
    }),
};

export class Renderer {
  readonly preview?: string;
  readonly inputs_count: number;
  private components: Record<string, Component>;
  private layout: any;
  constructor(style: SubStyle) {
    this.preview = style.preview;
    this.inputs_count = style.inputs;
    this.components = Object.fromEntries(
      Object.entries(style.components).map(([k, v]) => [
        k,
        component_builders[v.type](v as any),
      ])
    );
    this.layout = new AutoLayout.View({
      constraints: AutoLayout.VisualFormat.parse(style.layout, {
        extended: true,
      }),
    });
  }

  render(inputs: string[]) {
    const instances = Object.fromEntries(
      Object.entries(this.components).map(([k, v]) => [k, v(inputs)])
    );
    for (const [key, instance] of Object.entries(instances)) {
      if (instance.size != null) {
        Object.assign(this.layout.subViews[key], {
          intrinsicWidth: instance.size.width,
          intrinsicHeight: instance.size.height,
        });
      }
    }
    const canvas = new Canvas(
      this.layout.fittingWidth | 0,
      this.layout.fittingHeight | 0,
      "image"
    );
    const ctx = canvas.getContext("2d");
    ctx.font = config.font;
    for (const [key, instance] of Object.entries(instances)) {
      const { left: x, top: y, width, height } = this.layout.subViews[key];
      instance.render(ctx, x, y, width, height);
    }
    return canvas;
  }
}

export default Object.fromEntries(
  Object.entries(config.styles).map(([k, v]) => [
    k,
    Object.fromEntries(Object.entries(v).map(([k, v]) => [k, new Renderer(v)])),
  ])
);
