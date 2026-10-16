import { createToken } from "@/di/token.js";
import type { HealthConfig } from "@/config/healthConfig.js";
import type { DependencyChecker } from "./DependencyChecker.js";
import type { DependencyStatusRecord } from "./DependencyStatusRecord.js";
import type { RedisDependencyObserver } from "./RedisDependencyObserver.js";
import type { WorkerReadiness } from "./WorkerReadiness.js";

export const healthConfigToken = createToken<HealthConfig>("healthConfig");

export const postgresStatusToken = createToken<DependencyStatusRecord>("postgresStatus");

export const redisStatusToken = createToken<DependencyStatusRecord>("redisStatus");

export const postgresCheckerToken = createToken<DependencyChecker>("postgresChecker");

export const redisCheckerToken = createToken<DependencyChecker>("redisChecker");

export const redisObserverToken = createToken<RedisDependencyObserver>("redisObserver");

export const workerReadinessToken = createToken<WorkerReadiness>("workerReadiness");
