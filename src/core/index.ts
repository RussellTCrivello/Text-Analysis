/**
 * Public surface of the Text Analysis Manager core.
 *
 * Everything here is framework-agnostic and dependency-free: the React layer
 * imports from this barrel only, so the same code can be driven from tests, a
 * CLI, or a future desktop/electron shell.
 */
export * from './schema';
export * from './text';
export * from './validation';
export * from './audit';
export * from './persist';
export * from './repository';
export * from './stats';
export * from './timeline';
export * from './search';
export * from './backup';
export * from './attachments';
export * from './print';

export * as sql from './sql/engine';
export * as exporters from './export/exporters';
export * as zip from './export/zip';
export * as extraction from './extract/engine';
export * as coordinates from './extract/coordinates';
export * as dates from './extract/dates';
export * as gazetteer from './extract/gazetteer';
export * as importer from './import/parse';
export * as importPipeline from './import/pipeline';
