// Equal Earth imagery pyramid. Everything is same-origin and static; the browser
// receives only visible tiles, never NASA's full-size source panels.
(function () {
  'use strict';

  var BASE = 'assets/earth-tiles/200407-v1/';
  var MAX_ACTIVE = 6;
  var MAX_CACHED = 64; // <= ~65 MiB of RGBA pixels (514-square tiles).

  function AtlasTiles(onChange) {
    this.onChange = onChange;
    this.manifest = null;
    this.cache = new Map();
    this.active = new Map();
    this.failed = new Map();
    this.wanted = [];
    this.signature = '';
    this.timer = null;
    this.frame = null;
    this.disposed = false;
    var self = this;
    this.manifestController = new AbortController();
    var timeout = setTimeout(function () {
      self.manifestController.abort();
    }, 15000);
    fetch(BASE + 'manifest.json', { signal: this.manifestController.signal })
      .then(function (r) {
        if (!r.ok) throw new Error('Tile manifest unavailable');
        return r.json();
      })
      .then(function (manifest) {
        if (self.disposed) return;
        if (
          manifest.version !== 1 ||
          manifest.projection !== 'Equal Earth' ||
          manifest.tileSize !== 512 ||
          manifest.gutter !== 1 ||
          !Array.isArray(manifest.levels) ||
          manifest.levels.length !== 7
        )
          return;
        self.manifest = manifest;
        self.changed();
      })
      .catch(function () {
        /* The overview and map controls remain usable offline. */
      })
      .finally(function () {
        clearTimeout(timeout);
      });
  }

  AtlasTiles.prototype.changed = function () {
    if (this.frame !== null || this.disposed) return;
    var self = this;
    this.frame = requestAnimationFrame(function () {
      self.frame = null;
      if (!self.disposed) self.onChange();
    });
  };

  AtlasTiles.prototype.selection = function (view, w, h, dpr, ceiling) {
    var m = this.manifest,
      e = m.extent,
      spanX = e[2] - e[0],
      spanY = e[3] - e[1];
    var physicalWidth = spanX * view.scale * Math.min(dpr, 2);
    // The overview covers level zero. Request one appropriate level, not every
    // ancestor. Cached ancestors remain visible while sharper tiles arrive.
    if (physicalWidth <= m.levels[0].width) return [];
    var z = 1;
    var limit = ceiling === undefined ? m.levels.length - 1 : ceiling;
    while (z < limit && m.levels[z].width < physicalWidth) z++;
    var level = m.levels[z],
      size = m.tileSize;
    var x0 = Math.max(
      0,
      Math.floor((((view.cx - w / 2 / view.scale - e[0]) / spanX) * level.width) / size)
    );
    var x1 = Math.min(
      Math.ceil(level.width / size) - 1,
      Math.floor((((view.cx + w / 2 / view.scale - e[0]) / spanX) * level.width) / size)
    );
    var y0 = Math.max(
      0,
      Math.floor((((e[3] - view.cy - h / 2 / view.scale) / spanY) * level.height) / size)
    );
    var y1 = Math.min(
      Math.ceil(level.height / size) - 1,
      Math.floor((((e[3] - view.cy + h / 2 / view.scale) / spanY) * level.height) / size)
    );
    var selected = [];
    var cx = (((view.cx - e[0]) / spanX) * level.width) / size;
    var cy = (((e[3] - view.cy) / spanY) * level.height) / size;
    for (var y = y0; y <= y1; y++) {
      var row = level.rows[y];
      if (!row) continue;
      for (var x = Math.max(x0, row[0]); x <= Math.min(x1, row[1]); x++) {
        selected.push({
          key: z + '/' + x + '/' + y,
          z: z,
          x: x,
          y: y,
          distance: Math.hypot(x + 0.5 - cx, y + 0.5 - cy),
        });
      }
    }
    // On large/retina displays choose a coarser complete viewport instead of
    // sharpening only its centre or exceeding the decoded-pixel budget.
    if (selected.length > MAX_CACHED && z > 1) return this.selection(view, w, h, dpr, z - 1);
    selected.sort(function (a, b) {
      return a.distance - b.distance;
    });
    return selected;
  };

  AtlasTiles.prototype.update = function (view, w, h, dpr) {
    if (!this.manifest || this.disposed || !view.scale || !w || !h) return;
    var selected = this.selection(view, w, h, dpr);
    var signature = selected
      .map(function (t) {
        return t.key;
      })
      .join('|');
    if (signature === this.signature) return;
    this.signature = signature;
    this.wanted = selected;
    var keys = new Set(
      selected.map(function (t) {
        return t.key;
      })
    );
    this.active.forEach(function (job, key) {
      if (!keys.has(key)) job.controller.abort();
    });
    clearTimeout(this.timer);
    var self = this;
    // Do not download each intermediate level during wheel/pinch/fly animations.
    this.timer = setTimeout(function () {
      self.timer = null;
      self.pump();
    }, 100);
  };

  AtlasTiles.prototype.pump = function () {
    if (this.disposed || this.timer !== null) return;
    var self = this;
    this.wanted.forEach(function (tile) {
      if (self.active.size >= MAX_ACTIVE || self.cache.has(tile.key) || self.active.has(tile.key))
        return;
      // Remember recent failures in a bounded history; no retry storm while
      // offline or when a publication is incomplete.
      if (self.failed.has(tile.key)) return;
      var controller = new AbortController();
      var job = { controller: controller };
      self.active.set(tile.key, job);
      var timeout = setTimeout(function () {
        job.timedOut = true;
        controller.abort();
      }, 15000);
      fetch(BASE + tile.key + '.webp', { signal: controller.signal })
        .then(function (r) {
          if (!r.ok) throw new Error('Tile unavailable');
          return r.blob();
        })
        .then(function (blob) {
          if (controller.signal.aborted || self.disposed) return null;
          return createImageBitmap(blob);
        })
        .then(function (bitmap) {
          if (!bitmap) return;
          if (
            self.disposed ||
            controller.signal.aborted ||
            !self.wanted.some(function (t) {
              return t.key === tile.key;
            })
          ) {
            bitmap.close();
            return;
          }
          self.cache.set(tile.key, { tile: tile, bitmap: bitmap });
          while (self.cache.size > MAX_CACHED) {
            var oldest = self.cache.keys().next().value;
            self.cache.get(oldest).bitmap.close();
            self.cache.delete(oldest);
          }
          self.changed();
        })
        .catch(function () {
          if (!controller.signal.aborted || job.timedOut) {
            self.failed.set(tile.key, true);
            if (self.failed.size > 256) self.failed.delete(self.failed.keys().next().value);
          }
        })
        .finally(function () {
          clearTimeout(timeout);
          self.active.delete(tile.key);
          self.pump();
        });
    });
  };

  // ctx is already transformed to projection coordinates, with positive y up.
  AtlasTiles.prototype.draw = function (ctx, view, w, h, dpr) {
    this.update(view, w, h, dpr);
    if (!this.manifest || !this.wanted.length) return;
    var self = this,
      m = this.manifest,
      e = m.extent;
    var z = this.wanted[0].z;
    var entries = Array.from(this.cache.values()).filter(function (entry) {
      return entry.tile.z <= z;
    });
    entries.sort(function (a, b) {
      return a.tile.z - b.tile.z;
    });
    ctx.save();
    ctx.translate(e[0], e[3]);
    ctx.scale(1, -1);
    entries.forEach(function (entry) {
      var t = entry.tile,
        level = m.levels[t.z];
      var dx = (e[2] - e[0]) / level.width,
        dy = (e[3] - e[1]) / level.height;
      var x = (t.x * m.tileSize - m.gutter) * dx,
        y = (t.y * m.tileSize - m.gutter) * dy;
      var width = entry.bitmap.width * dx,
        height = entry.bitmap.height * dy;
      if (
        e[0] + x > view.cx + w / 2 / view.scale ||
        e[0] + x + width < view.cx - w / 2 / view.scale ||
        e[3] - y < view.cy - h / 2 / view.scale ||
        e[3] - y - height > view.cy + h / 2 / view.scale
      )
        return;
      ctx.drawImage(entry.bitmap, x, y, width, height);
      self.cache.delete(t.key);
      self.cache.set(t.key, entry);
    });
    ctx.restore();
  };

  AtlasTiles.prototype.dispose = function () {
    this.disposed = true;
    clearTimeout(this.timer);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.manifestController.abort();
    this.active.forEach(function (job) {
      job.controller.abort();
    });
    this.cache.forEach(function (entry) {
      entry.bitmap.close();
    });
    this.cache.clear();
  };

  window.AtlasTiles = AtlasTiles;
})();
