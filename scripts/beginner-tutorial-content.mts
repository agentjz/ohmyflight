import fs from "node:fs/promises";
import path from "node:path";

import type {
  BeginnerTutorialData,
  BeginnerTutorialManifest,
  TutorialEmbeddedRecord,
  TutorialModule,
  TutorialRecord,
  TutorialRecordBase,
  TutorialRecordLink,
  TutorialSourceModule,
  TutorialSourceRecord,
  TutorialSourceRef
} from "../src/tool/app/beginner-tutorial/types";

interface IndexedRecord {
  moduleId: string;
  record: TutorialSourceRecord;
}

export async function loadBeginnerTutorialData(contentRoot: string): Promise<BeginnerTutorialData> {
  const manifest = await readJson<BeginnerTutorialManifest>(path.join(contentRoot, "manifest.json"));
  assertManifest(manifest);

  const sourceScope = await readJson<TutorialSourceRef[]>(path.join(contentRoot, manifest.sourceFile));
  const sourceIndex = uniqueIndex(sourceScope, "手册来源");
  const sourceModules = await Promise.all(
    manifest.moduleFiles.map((fileName) => readJson<TutorialSourceModule>(path.join(contentRoot, fileName)))
  );
  uniqueIndex(sourceModules, "模块");

  const recordIndex = new Map<string, IndexedRecord>();
  for (const module of sourceModules) {
    for (const record of module.records || []) {
      if (recordIndex.has(record.id)) throw new Error(`菜鸟教程记录 ID 重复：${record.id}。`);
      recordIndex.set(record.id, { moduleId: module.id, record });
    }
  }

  const resolveSources = (ids: string[] | undefined, owner: string): TutorialSourceRef[] =>
    (ids || []).map((id) => {
      const source = sourceIndex.get(id);
      if (!source) throw new Error(`菜鸟教程知识项 ${owner} 引用了不存在的来源 ${id}。`);
      return source;
    });

  const resolveEmbeddedRecord = (id: string, owner: string): TutorialEmbeddedRecord => {
    const indexed = recordIndex.get(id);
    if (!indexed) throw new Error(`菜鸟教程知识项 ${owner} 引用了不存在的复用记录 ${id}。`);
    return {
      ...toRecordBase(indexed.record),
      moduleId: indexed.moduleId,
      sources: resolveSources(indexed.record.sourceIds, indexed.record.id)
    };
  };

  const resolveLink = (id: string, owner: string): TutorialRecordLink => {
    const indexed = recordIndex.get(id);
    if (!indexed) throw new Error(`菜鸟教程知识项 ${owner} 引用了不存在的关联记录 ${id}。`);
    return {
      moduleId: indexed.moduleId,
      targetId: indexed.record.id,
      title: indexed.record.title
    };
  };

  const modules: TutorialModule[] = [];
  for (const sourceModule of sourceModules) {
    const { records: _sourceRecords, ...moduleBase } = sourceModule;
    const moduleBody = sourceModule.bodyFile
      ? (await fs.readFile(path.join(contentRoot, sourceModule.bodyFile), "utf8")).trim()
      : undefined;
    const records: TutorialRecord[] | undefined = sourceModule.records?.map((record) => ({
      ...toRecordBase(record),
      sourceIds: record.sourceIds,
      sources: resolveSources(record.sourceIds, record.id),
      embeddedRecords: record.reuseRecordIds?.map((id) => resolveEmbeddedRecord(id, record.id)),
      relatedRecords: record.relatedRecordIds?.map((id) => resolveLink(id, record.id))
    }));
    const steps = sourceModule.steps?.map((step) => ({
      ...step,
      sources: resolveSources(step.sourceIds, step.id)
    }));

    modules.push({
      ...moduleBase,
      ...(moduleBody === undefined ? {} : { body: moduleBody }),
      ...(records === undefined ? {} : { records }),
      ...(steps === undefined ? {} : { steps }),
      sources: resolveSources(sourceModule.sourceIds, sourceModule.id)
    });
  }

  return {
    schemaVersion: manifest.schemaVersion,
    title: manifest.title,
    description: manifest.description,
    sourceScope,
    modules
  };
}

function toRecordBase(record: TutorialSourceRecord): TutorialRecordBase {
  const {
    sourceIds: _sourceIds,
    reuseRecordIds: _reuseRecordIds,
    relatedRecordIds: _relatedRecordIds,
    ...base
  } = record;
  return base;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

function assertManifest(manifest: BeginnerTutorialManifest): void {
  if (
    manifest.schemaVersion !== 1
    || !manifest.title
    || !manifest.description
    || !manifest.sourceFile
    || !Array.isArray(manifest.moduleFiles)
    || manifest.moduleFiles.length === 0
  ) {
    throw new Error("菜鸟教程知识源清单结构无效。");
  }
}

function uniqueIndex<T extends { id: string }>(items: T[], label: string): Map<string, T> {
  const index = new Map<string, T>();
  for (const item of items) {
    if (!item.id) throw new Error(`菜鸟教程${label}缺少 ID。`);
    if (index.has(item.id)) throw new Error(`菜鸟教程${label} ID 重复：${item.id}。`);
    index.set(item.id, item);
  }
  return index;
}
