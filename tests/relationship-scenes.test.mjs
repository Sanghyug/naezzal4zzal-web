import test from "node:test";
import assert from "node:assert/strict";
import { relationshipScenes, relationshipScene, scenesForCount } from "../src/lib/relationshipScenes.ts";
test("nine approved scenes, historical IDs retained",()=>{assert.equal(new Set(relationshipScenes.map(s=>s.id)).size,18);assert.equal(scenesForCount(0).length,0);assert.equal(scenesForCount(1).length,0);assert.deepEqual(scenesForCount(2).map(s=>s.id),["a03","a01","c04"]);assert.deepEqual(scenesForCount(3).map(s=>s.id),["b01","b04","b02"]);assert.deepEqual(scenesForCount(4).map(s=>s.id),["d01","d04","d05"]);assert.equal(relationshipScene("arbitrary prompt"),undefined);});
