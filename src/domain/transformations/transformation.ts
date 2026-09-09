export interface FieldMapping {
  sourcePath: string;
  targetPath: string;
  required?: boolean;
  defaultValue?: unknown;
  transform?: "passthrough" | "uppercase" | "dateIso";
}

export interface TransformationDefinition {
  id: string;
  code: string;
  version: number;
  sourceModel: "AdmissionEvent" | string;
  targetFormat: string;
  mappings: FieldMapping[];
}

export interface MappingTraceEntry {
  sourcePath: string;
  targetPath: string;
  status: "MAPPED" | "MISSING" | "DEFAULT";
}

export interface TransformResult {
  payload: Record<string, unknown>;
  mappingTrace: MappingTraceEntry[];
}
