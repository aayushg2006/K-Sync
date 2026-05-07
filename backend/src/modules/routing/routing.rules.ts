import { ServiceType, SystemName } from "../../common/types/system.types";

type RoutingKey = `${SystemName}:${ServiceType}`;

const routingRules: Partial<Record<RoutingKey, SystemName[]>> = {
  "SWS:REGISTERED_ADDRESS_CHANGE": ["EKARMIKA", "ESURAKSHATE"],
  "SWS:AUTHORIZED_SIGNATORY_CHANGE": ["EKARMIKA", "ESURAKSHATE"],
  "EKARMIKA:EMPLOYEE_COUNT_CHANGE": ["SWS"],
  "ESURAKSHATE:AUTHORIZED_SIGNATORY_CHANGE": ["SWS"],
  "ESURAKSHATE:LICENSE_EXPIRY_CHANGE": ["SWS"],
};

export function getRoutingRuleTargets(sourceSystem: SystemName, serviceType: ServiceType): SystemName[] {
  return routingRules[`${sourceSystem}:${serviceType}`] ?? [];
}
