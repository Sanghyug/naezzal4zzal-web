import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateCells,createLayoutCells} from '../src/lib/photoGeometry.js';
test('full-width prints work in both layouts',()=>{ for(const layout of ['1x4','2x2']) assert.equal(validateCells(createLayoutCells(layout,1000,1000),1000,1000).length,4); });
test('bad geometry is rejected',()=>{const cells=createLayoutCells('1x4',1000,1000); for(const change of [{x:-1},{width:Infinity},{y:1000},{height:0}]) assert.deepEqual(validateCells([{...cells[0],...change},...cells.slice(1)],1000,1000),[]); assert.deepEqual(validateCells(Array(4).fill(cells[0]),1000,1000),[]); assert.deepEqual(validateCells(cells.slice(1),1000,1000),[]);});
