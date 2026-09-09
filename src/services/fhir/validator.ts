import type { FhirValidator, FhirValidationResult } from "@/src/domain/ports";
import {
  asBundle,
  extractResources,
  findResource,
  findResources,
  getNestedString,
  isObject,
  resolveReference,
  type FhirResource,
} from "./bundle-utils";

const CLASS_MAP: Record<string, string> = {
  IMP: "INPATIENT",
  INPATIENT: "INPATIENT",
  AMB: "OUTPATIENT",
  OUT: "OUTPATIENT",
  HH: "OUTPATIENT",
  EMER: "EMERGENCY",
  VR: "VIRTUAL",
};

export function mapEncounterClass(code?: string): string | undefined {
  if (!code) return undefined;
  return CLASS_MAP[code.toUpperCase()] ?? code.toUpperCase();
}

export function inferPayerType(resources: FhirResource[], coverage?: FhirResource): string | undefined {
  if (!coverage) return undefined;

  const payors = Array.isArray(coverage.payor) ? coverage.payor : [];
  for (const payor of payors) {
    if (!isObject(payor)) continue;
    const ref = typeof payor.reference === "string" ? payor.reference : undefined;
    const display = typeof payor.display === "string" ? payor.display : undefined;
    const org = resolveReference(resources, ref);

    const identifiers = Array.isArray(org?.identifier) ? org.identifier : [];
    for (const ident of identifiers) {
      if (!isObject(ident)) continue;
      const value = typeof ident.value === "string" ? ident.value.toUpperCase() : "";
      if (["MEDICARE", "MEDICAID", "COMMERCIAL"].includes(value)) {
        return value;
      }
    }

    const name = typeof org?.name === "string" ? org.name : display ?? "";
    const upper = name.toUpperCase();
    if (upper.includes("MEDICARE")) return "MEDICARE";
    if (upper.includes("MEDICAID")) return "MEDICAID";
    if (upper.includes("COMMERCIAL") || upper.includes("BLUE")) return "COMMERCIAL";
  }

  return undefined;
}

/**
 * Targeted NOA admission Bundle validation — not a full FHIR validator.
 */
export class AdmissionFhirValidator implements FhirValidator {
  async validate(bundle: unknown): Promise<FhirValidationResult> {
    const errors: FhirValidationResult["errors"] = [];

    const fhirBundle = asBundle(bundle);
    if (!fhirBundle) {
      return {
        ok: false,
        errors: [
          {
            path: "resourceType",
            code: "NOT_A_BUNDLE",
            message: "Payload must be a FHIR R4 Bundle",
          },
        ],
      };
    }

    const resources = extractResources(fhirBundle);
    if (resources.length === 0) {
      errors.push({
        path: "entry",
        code: "EMPTY_BUNDLE",
        message: "Bundle.entry must contain at least one resource",
      });
    }

    if (fhirBundle.type === "message" && !findResource(resources, "MessageHeader")) {
      errors.push({
        path: "entry",
        code: "MISSING_MESSAGE_HEADER",
        message: "message Bundle requires MessageHeader",
      });
    }

    const patient = findResource(resources, "Patient");
    if (!patient) {
      errors.push({
        path: "entry",
        code: "MISSING_PATIENT",
        message: "Patient resource is required",
      });
    }

    const encounter = findResource(resources, "Encounter");
    if (!encounter) {
      errors.push({
        path: "entry",
        code: "MISSING_ENCOUNTER",
        message: "Encounter resource is required",
      });
    } else {
      const classCode =
        getNestedString(encounter as Record<string, unknown>, ["class", "code"]) ??
        (isObject(encounter.class) && typeof encounter.class.code === "string"
          ? encounter.class.code
          : undefined);
      const mapped = mapEncounterClass(classCode);
      if (!mapped) {
        errors.push({
          path: "Encounter.class",
          code: "MISSING_ENCOUNTER_CLASS",
          message: "Encounter.class.code is required",
        });
      }

      const periodStart = getNestedString(encounter as Record<string, unknown>, [
        "period",
        "start",
      ]);
      if (!periodStart) {
        errors.push({
          path: "Encounter.period.start",
          code: "MISSING_ADMISSION_DATETIME",
          message: "Encounter.period.start is required for admission notifications",
        });
      }
    }

    const coverage = findResource(resources, "Coverage");
    if (!coverage) {
      errors.push({
        path: "entry",
        code: "MISSING_COVERAGE",
        message: "Coverage resource is required",
      });
    } else {
      const payors = Array.isArray(coverage.payor) ? coverage.payor : [];
      if (payors.length === 0) {
        errors.push({
          path: "Coverage.payor",
          code: "MISSING_PAYOR",
          message: "Coverage.payor is required",
        });
      } else {
        const payerType = inferPayerType(resources, coverage);
        if (!payerType) {
          // Soft requirement for golden path: warn via error for POC semantic check
          errors.push({
            path: "Coverage.payor",
            code: "UNRESOLVED_PAYER_TYPE",
            message:
              "Unable to resolve payer type (MEDICARE|MEDICAID|COMMERCIAL) from Coverage.payor",
          });
        }
      }
    }

    const organizations = findResources(resources, "Organization");
    if (organizations.length === 0) {
      errors.push({
        path: "entry",
        code: "MISSING_ORGANIZATION",
        message: "At least one Organization (facility and/or payer) is required",
      });
    }

    return { ok: errors.length === 0, errors };
  }
}
