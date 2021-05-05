import { MetricType } from "./metrics";
import { redis } from "../../redis";

export const cloudMetric = async (metric: MetricType, values: number[], dimensions?: Array<{ name: string; value: string; }>) => 
	redis.lpush(`metric-${metric}`, JSON.stringify({
		timestamp: new Date().getTime(),
		values,
		dimensions
	}))