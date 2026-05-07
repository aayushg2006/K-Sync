import { CanonicalEvent } from "../../common/types/event.types";
import { SystemName } from "../../common/types/system.types";
import { TranslationResult } from "../translation/translation.service";
import { ResolvedTarget } from "../ubid-registry/ubid.service";

export interface AdapterTarget extends ResolvedTarget {
  localIdentifier: string;
  localIdentifierType: string;
}

export interface AdapterWriteResult {
  localIdentifier: string;
  metadata?: Record<string, unknown>;
  targetSystem: SystemName;
  updatedFields: string[];
}

export interface DepartmentAdapter {
  readonly targetSystem: SystemName;
  confirm(result: AdapterWriteResult): Promise<AdapterWriteResult> | AdapterWriteResult;
  rollbackOrCompensate?(
    event: CanonicalEvent,
    target: AdapterTarget,
    result?: AdapterWriteResult,
  ): Promise<void> | void;
  translate(
    event: CanonicalEvent,
    target: AdapterTarget,
  ): Promise<TranslationResult>;
  validateTarget(
    event: CanonicalEvent,
    target: AdapterTarget,
  ): Promise<void> | void;
  write(
    translatedPayload: unknown,
    target: AdapterTarget,
    event: CanonicalEvent,
  ): Promise<AdapterWriteResult>;
}
