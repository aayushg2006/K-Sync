import { SystemName } from "../../common/types/system.types";
import { DepartmentAdapter } from "./DepartmentAdapter";
import { ekarmikaAdapter } from "./ekarmika.adapter";
import { esurakshateAdapter } from "./esurakshate.adapter";
import { swsAdapter } from "./sws.adapter";

const adaptersByTargetSystem: Record<SystemName, DepartmentAdapter | undefined> = {
  EKARMIKA: ekarmikaAdapter,
  ESURAKSHATE: esurakshateAdapter,
  KSYNC: undefined,
  SWS: swsAdapter,
};

export function getAdapterForTargetSystem(
  targetSystem: SystemName,
): DepartmentAdapter | undefined {
  return adaptersByTargetSystem[targetSystem];
}
