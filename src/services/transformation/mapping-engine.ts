import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { Decision } from "@/src/domain/decisions/decision";
import type {
  FieldMapping,
  MappingTraceEntry,
  TransformationDefinition,
  TransformResult,
} from "@/src/domain/transformations/transformation";
import type { TransformationEngine } from "@/src/domain/ports";
import { getByPath } from "@/src/utils/path-get";
import { setByPath } from "@/src/utils/path-set";
import { AppError } from "@/src/domain/errors/app-error";

export class TransformFailedError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("TRANSFORM_FAILED", message, { statusCode: 422, details });
    this.name = "TransformFailedError";
  }
}

function applyValueTransform(
  value: unknown,
  transform?: FieldMapping["transform"]
): unknown {
  if (value == null || !transform || transform === "passthrough") {
    return value;
  }
  if (transform === "uppercase" && typeof value === "string") {
    return value.toUpperCase();
  }
  if (transform === "first" && Array.isArray(value)) {
    return value[0];
  }
  if (transform === "join" && Array.isArray(value)) {
    return value.filter((v) => typeof v === "string").join(" ");
  }
  if (transform === "dateIso") {
    if (typeof value === "string" || value instanceof Date) {
      const d = value instanceof Date ? value : new Date(value);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return value;
}

export type TransformSource = AdmissionEvent & {
  notificationType?: string;
  decision?: Decision;
};

/**
 * Simple field-path mapping engine. Replaceable later with JSONata/StructureMap.
 */
export class SimpleMappingTransformationEngine implements TransformationEngine {
  async transform(
    event: AdmissionEvent,
    definition: TransformationDefinition,
    decision?: Decision
  ): Promise<TransformResult> {
    const source: TransformSource = {
      ...event,
      notificationType: decision?.notificationType ?? "NOA",
      decision,
    };

    const payload: Record<string, unknown> = {};
    const mappingTrace: MappingTraceEntry[] = [];
    const missingRequired: string[] = [];

    for (const mapping of definition.mappings) {
      let value = getByPath(source, mapping.sourcePath);
      let status: MappingTraceEntry["status"] = "MAPPED";

      if (value === undefined || value === null || value === "") {
        if (mapping.defaultValue !== undefined) {
          value = mapping.defaultValue;
          status = "DEFAULT";
        } else {
          status = "MISSING";
          if (mapping.required) {
            missingRequired.push(mapping.targetPath);
          }
        }
      } else {
        value = applyValueTransform(value, mapping.transform);
      }

      mappingTrace.push({
        sourcePath: mapping.sourcePath,
        targetPath: mapping.targetPath,
        status,
      });

      if (status !== "MISSING") {
        setByPath(payload, mapping.targetPath, value);
      }
    }

    if (missingRequired.length > 0) {
      throw new TransformFailedError("Required mapping fields missing", {
        missingRequired,
        transformerCode: definition.code,
      });
    }

    return { payload, mappingTrace };
  }
}
