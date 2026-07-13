import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WhoopClient } from "../../whoop/client.js";
import { HrCurveOut } from "../../schemas/sleep.js";
import { projectSleepHrCurve } from "../../projections/sleep.js";
import { WhoopProjectionError } from "../../whoop/errors.js";
import { jsonOut } from "../../whoop/json_out.js";
import { todayIso } from "../../lib/dates.js";

export function registerHrCurve(server: McpServer, client: WhoopClient): void {
  server.tool(
    "whoop_hr_curve",
    "The overnight in-sleep heart-rate curve for a night, as timestamped points ({at, bpm, stage}) reconstructed from the sleep deep-dive's per-stage HR LINE_PLOTs. Pass the same `date` you'd give whoop_sleep (defaults to today). NOTE: these are the app's graph points (a reading every few minutes), NOT raw per-second sensor samples — those live only in Whoop's binary telemetry stream. Timestamps are accurate to a few minutes (midpoint-anchored), and coverage is the sleep window only.",
    { date: z.iso.date().optional() },
    async ({ date }) => {
      const d = date ?? todayIso();
      const raw = await client.get("/home-service/v1/deep-dive/sleep/last-night", { date: d });
      const projected = projectSleepHrCurve(raw, d);
      try {
        const out = HrCurveOut.parse(projected);
        return { content: [{ type: "text", text: jsonOut(out) }] };
      } catch (e) {
        if (e instanceof z.ZodError) throw new WhoopProjectionError("whoop_hr_curve", e);
        throw e;
      }
    },
  );
}
