import { ServiceType, SystemName } from "../../common/types/system.types";
import { parseFactoryXml } from "../mock-esurakshate/esurakshate.xml";
import { applyJsonataMapping } from "./jsonata.engine";
import { getActiveMapping } from "./schema-registry.service";

export interface TranslationResult<T = unknown> {
  mappingId: string;
  translatedPayload: T;
  version: number;
}

function normalizeEsurakshateXmlPayload(payload: unknown) {
  if (typeof payload !== "string") {
    return payload;
  }

  const parsedPayload = parseFactoryXml(payload);

  if (
    parsedPayload &&
    typeof parsedPayload === "object" &&
    !Array.isArray(parsedPayload) &&
    "FactorySnapshot" in parsedPayload
  ) {
    const factorySnapshot = (parsedPayload as { FactorySnapshot?: unknown }).FactorySnapshot;

    if (factorySnapshot && typeof factorySnapshot === "object") {
      return factorySnapshot;
    }
  }

  return parsedPayload;
}

function normalizeSourcePayload(sourceSystem: SystemName, sourcePayload: unknown) {
  if (sourceSystem === "ESURAKSHATE") {
    return normalizeEsurakshateXmlPayload(sourcePayload);
  }

  return sourcePayload;
}

export async function translate<T = unknown>(
  sourceSystem: SystemName,
  targetSystem: SystemName,
  serviceType: ServiceType,
  sourcePayload: unknown,
): Promise<TranslationResult<T>> {
  const mapping = await getActiveMapping(sourceSystem, targetSystem, serviceType);
  const normalizedPayload = normalizeSourcePayload(sourceSystem, sourcePayload);
  const translatedPayload = await applyJsonataMapping<T>(
    mapping.mappingExpression,
    normalizedPayload,
  );

  return {
    mappingId: mapping.mappingId,
    translatedPayload,
    version: mapping.version,
  };
}

export function translateSwsToEkarmika<T = unknown>(
  payload: unknown,
  serviceType: ServiceType,
): Promise<TranslationResult<T>> {
  return translate<T>("SWS", "EKARMIKA", serviceType, payload);
}

export function translateSwsToEsurakshate<T = unknown>(
  payload: unknown,
  serviceType: ServiceType,
): Promise<TranslationResult<T>> {
  return translate<T>("SWS", "ESURAKSHATE", serviceType, payload);
}

export function translateEkarmikaToSws<T = unknown>(
  payload: unknown,
  serviceType: ServiceType,
): Promise<TranslationResult<T>> {
  return translate<T>("EKARMIKA", "SWS", serviceType, payload);
}

export function translateEsurakshateToSws<T = unknown>(
  payload: unknown,
  serviceType: ServiceType,
): Promise<TranslationResult<T>> {
  return translate<T>("ESURAKSHATE", "SWS", serviceType, payload);
}
