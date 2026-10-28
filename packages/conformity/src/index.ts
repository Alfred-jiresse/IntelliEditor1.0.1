// @intellieditor/conformity — public surface.
//
// Layers, each importing only the ones above it:
//   xml/       bounded DOCX reading (the trust boundary, via the engine's readZip/readXml)
//   model/     the read model rules see
//   reader/    xml → model (style cascade, sections, fields)
//   analysis/  model → thesis structure (parts, chapters, introduction sections)
//   profile/   the norm as data (UDBL built in, JSON override)
//   rules/     one pure function per norm requirement
//   engine     orchestration + report
//   template/  « Nouveau TFC »: a document that satisfies the same profile

export { checkDocument, checkDocx } from './engine.ts';
export type {
  ConformityLevel,
  ConformityReport,
  ConformityRun,
  ConformitySummary,
  RuleResult,
  RuleStatus,
} from './engine.ts';
export { readDocumentModel } from './reader/index.ts';
export type { DocumentModel, ParagraphModel, SectionModel } from './model/types.ts';
export { analyzeStructure, type DocumentStructure } from './analysis/structure.ts';
export { UDBL_TFC_PROFILE } from './profile/udbl-tfc.ts';
export { parseProfile, type ProfileParseResult } from './profile/parse-profile.ts';
export type { ConformityProfile, Severity } from './profile/types.ts';
export { ALL_RULES } from './rules/index.ts';
export type { Finding, FindingLocation, FixSuggestion, Rule, RuleCategory } from './rules/index.ts';
export {
  createTfcTemplate,
  DEFAULT_COVER,
  type CoverLogo,
  type CoverMetadata,
} from './template/tfc-template.ts';
