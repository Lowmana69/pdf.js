/* Copyright 2017 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assert, CMapCompressionType } from '../../src/shared/util';
import isNodeJS from '../../src/shared/is_node';
import { isRef } from '../../src/core/primitives';

class NodeFileReaderFactory {
  static fetch(params) {
    var fs = require('fs');
    var file = fs.readFileSync(params.path);
    return new Uint8Array(file);
  }
}

const TEST_PDFS_PATH = {
  dom: '../pdfs/',
  node: './test/pdfs/',
};

function buildGetDocumentParams(filename, options) {
  let params = Object.create(null);
  if (isNodeJS()) {
    params.url = TEST_PDFS_PATH.node + filename;
  } else {
    params.url = new URL(TEST_PDFS_PATH.dom + filename, window.location).href;
  }
  for (let option in options) {
    params[option] = options[option];
  }
  return params;
}

class NodeCanvasFactory {
  create(width, height) {
    assert(width > 0 && height > 0, 'Invalid canvas size');

    const Canvas = require('canvas');
    const canvas = Canvas.createCanvas(width, height);
    return {
      canvas,
      context: canvas.getContext('2d'),
    };
  }

  reset(canvasAndContext, width, height) {
    assert(canvasAndContext.canvas, 'Canvas is not specified');
    assert(width > 0 && height > 0, 'Invalid canvas size');

    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    assert(canvasAndContext.canvas, 'Canvas is not specified');

    // Zeroing the width and height cause Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

class NodeCMapReaderFactory {
  constructor({ baseUrl = null, isCompressed = false, }) {
    this.baseUrl = baseUrl;
    this.isCompressed = isCompressed;
  }

  fetch({ name, }) {
    if (!this.baseUrl) {
      return Promise.reject(new Error(
        'The CMap "baseUrl" parameter must be specified, ensure that ' +
        'the "cMapUrl" and "cMapPacked" API parameters are provided.'));
    }
    if (!name) {
      return Promise.reject(new Error('CMap name must be specified.'));
    }
    return new Promise((resolve, reject) => {
      let url = this.baseUrl + name + (this.isCompressed ? '.bcmap' : '');

      let fs = require('fs');
      fs.readFile(url, (error, data) => {
        if (error || !data) {
          reject(new Error('Unable to load ' +
                           (this.isCompressed ? 'binary ' : '') +
                           'CMap at: ' + url));
          return;
        }
        resolve({
          cMapData: new Uint8Array(data),
          compressionType: this.isCompressed ?
            CMapCompressionType.BINARY : CMapCompressionType.NONE,
        });
      });
    });
  }
}

class XRefMock {
  constructor(array) {
    this._map = Object.create(null);

    for (let key in array) {
      let obj = array[key];
      this._map[obj.ref.toString()] = obj.data;
    }
  }

  fetch(ref) {
    return this._map[ref.toString()];
  }

  fetchAsync(ref) {
    return Promise.resolve(this.fetch(ref));
  }

  fetchIfRef(obj) {
    if (!isRef(obj)) {
      return obj;
    }
    return this.fetch(obj);
  }

  fetchIfRefAsync(obj) {
    return Promise.resolve(this.fetchIfRef(obj));
  }
}

export {
  NodeFileReaderFactory,
  NodeCanvasFactory,
  NodeCMapReaderFactory,
  XRefMock,
  buildGetDocumentParams,
  TEST_PDFS_PATH,
};
