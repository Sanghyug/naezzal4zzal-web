import test from "node:test";
import assert from "node:assert/strict";
import { relationshipScenes, relationshipScene, scenesForCount } from "../src/lib/relationshipScenes.ts";
test("fixed relationship catalog is unique and count filtered",()=>{assert.equal(relationshipScenes.length,17);assert.equal(new Set(relationshipScenes.map(s=>s.id)).size,17);assert.equal(scenesForCount(1).length,0);assert.equal(scenesForCount(2).length,9);assert.equal(scenesForCount(3).length,4);assert.equal(scenesForCount(4).length,4);assert.equal(relationshipScene("arbitrary prompt"),undefined);});
