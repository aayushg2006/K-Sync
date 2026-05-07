import { CanonicalEvent } from "../../common/types/event.types";
import { EventStatus } from "../../common/types/system.types";
import { getRoutingRuleTargets } from "./routing.rules";
import { ResolvedTarget, resolveTargets } from "../ubid-registry/ubid.service";

export interface RoutingOutcome {
  resolutions: ResolvedTarget[];
  status: EventStatus;
  targets: ResolvedTarget[];
}

function deriveRoutingStatus(
  ruleTargets: CanonicalEvent["sourceSystem"][],
  validTargets: ResolvedTarget[],
  resolutions: ResolvedTarget[],
): EventStatus {
  if (validTargets.length > 0) {
    return "ROUTED";
  }

  if (ruleTargets.length === 0) {
    return "TARGET_NOT_APPLICABLE";
  }

  if (resolutions.some((resolution) => resolution.status === "TARGET_MAPPING_MISSING")) {
    return "TARGET_MAPPING_MISSING";
  }

  if (resolutions.some((resolution) => resolution.status === "REGISTRATION_REQUIRED")) {
    return "REGISTRATION_REQUIRED";
  }

  return "TARGET_NOT_APPLICABLE";
}

export async function getRoutingOutcome(
  event: Pick<CanonicalEvent, "serviceType" | "sourceSystem" | "ubid">,
): Promise<RoutingOutcome> {
  const ruleTargets = getRoutingRuleTargets(event.sourceSystem, event.serviceType).filter(
    (targetSystem) => targetSystem !== event.sourceSystem,
  );
  const resolutions = await resolveTargets(
    event.ubid,
    event.sourceSystem,
    event.serviceType,
  );
  const validTargets = resolutions.filter(
    (target): target is ResolvedTarget =>
      target.status === "ROUTABLE" &&
      target.targetSystem !== event.sourceSystem &&
      Boolean(target.localIdentifier),
  );

  return {
    resolutions,
    status: deriveRoutingStatus(ruleTargets, validTargets, resolutions),
    targets: validTargets,
  };
}

export async function getTargets(
  event: Pick<CanonicalEvent, "serviceType" | "sourceSystem" | "ubid">,
) {
  const routingOutcome = await getRoutingOutcome(event);
  return routingOutcome.targets;
}
