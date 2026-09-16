/* exported UILayout */
'use strict';
// Shared geometry for the workbench and atlas. Layout preferences never enter
// recipe/session state, and every restored dimension is bounded by the current view.
const UILayout = (() => {
  const updates = new Set(),
    resets = new Set();
  let frame = 0;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(n, Math.max(lo, hi)));
  const visible = (el) => el.isConnected && el.getClientRects().length > 0;
  const viewport = () => {
    const v = window.visualViewport;
    const x = (v?.offsetLeft || 0) + 8,
      y = (v?.offsetTop || 0) + 8;
    return {
      x,
      y,
      width: Math.max(1, (v?.width || innerWidth) - 16),
      height: Math.max(1, (v?.height || innerHeight) - 16),
    };
  };
  const refresh = () => {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        updates.forEach((update) => update());
      });
  };
  window.addEventListener('resize', refresh);
  document.addEventListener('scroll', refresh, true);
  window.visualViewport?.addEventListener('resize', refresh);
  window.visualViewport?.addEventListener('scroll', refresh);
  const read = (key) => {
    try {
      return JSON.parse(localStorage.getItem('codex-layout:' + key));
    } catch {
      return null;
    }
  };
  const save = (key, value) => {
    try {
      if (value === null) localStorage.removeItem('codex-layout:' + key);
      else localStorage.setItem('codex-layout:' + key, JSON.stringify(value));
    } catch {
      /* Resizing still works when storage is unavailable. */
    }
  };
  function watch(el, update, extra = []) {
    updates.add(update);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(refresh) : null;
    [el, ...extra].forEach((node) => ro?.observe(node));
    const mo = new MutationObserver(refresh);
    mo.observe(el, { childList: true, attributes: true, attributeFilter: ['hidden', 'class'] });
    refresh();
    return () => {
      updates.delete(update);
      ro?.disconnect();
      mo.disconnect();
    };
  }
  function anchor(panel, trigger, { align = 'start', maxWidth = Infinity } = {}) {
    panel.classList.add('layout-anchored');
    const update = () => {
      if (!visible(panel) || !visible(trigger)) return;
      const v = viewport(),
        r = trigger.getBoundingClientRect();
      panel.style.maxWidth = Math.min(v.width, maxWidth) + 'px';
      panel.style.minWidth = '0';
      const below = Math.max(0, v.y + v.height - r.bottom - 6);
      const above = Math.max(0, r.top - v.y - 6);
      const up = below < Math.min(panel.scrollHeight, 240) && above > below;
      panel.style.maxHeight = Math.max(1, up ? above : below) + 'px';
      const box = panel.getBoundingClientRect();
      panel.style.left =
        clamp(align === 'end' ? r.right - box.width : r.left, v.x, v.x + v.width - box.width) +
        'px';
      panel.style.top =
        clamp(up ? r.top - box.height - 6 : r.bottom + 6, v.y, v.y + v.height - box.height) + 'px';
    };
    const stop = watch(panel, update, [trigger]);
    update();
    return stop;
  }
  function tooltips() {
    let trigger = null,
      tip = null,
      timer = 0,
      stop = null;
    const close = () => {
      clearTimeout(timer);
      stop?.();
      stop = null;
      if (trigger) {
        const ids = (trigger.getAttribute('aria-describedby') || '')
          .split(/\s+/)
          .filter((id) => id && id !== 'layout-tooltip');
        if (ids.length) trigger.setAttribute('aria-describedby', ids.join(' '));
        else trigger.removeAttribute('aria-describedby');
      }
      tip?.remove();
      trigger = tip = null;
    };
    const open = (el, delay) => {
      if (el === trigger) return;
      close();
      if (!el) return;
      trigger = el;
      timer = setTimeout(() => {
        if (!visible(el)) return close();
        tip = document.createElement('div');
        tip.id = 'layout-tooltip';
        tip.className = 'layout-tooltip';
        tip.setAttribute('role', 'tooltip');
        tip.textContent = el.dataset.tooltip;
        document.body.append(tip);
        const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        el.setAttribute('aria-describedby', [...ids, tip.id].join(' '));
        stop = anchor(tip, el, { align: 'end', maxWidth: 320 });
      }, delay);
    };
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'touch') open(e.target.closest('[data-tooltip]'), 400);
    });
    document.addEventListener('pointerout', (e) => {
      if (trigger && !trigger.contains(e.relatedTarget)) close();
    });
    document.addEventListener('focusin', (e) => open(e.target.closest('[data-tooltip]'), 0));
    document.addEventListener('focusout', close);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    updates.add(() => {
      if (trigger && !visible(trigger)) close();
    });
  }
  // Pointer capture keeps a resize alive across iframes. Escape/pointercancel
  // restore the starting geometry; controls remain ordinary keyboard targets.
  function gesture(handle, start, change, end) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const initial = start();
      if (!initial) return;
      e.preventDefault();
      e.stopPropagation();
      handle.focus({ preventScroll: true });
      handle.setPointerCapture(e.pointerId);
      document.documentElement.classList.add('layout-dragging');
      const move = (event) => change(initial, event.clientX - e.clientX, event.clientY - e.clientY);
      const finish = (cancelled) => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', cancel);
        handle.removeEventListener('lostpointercapture', cancel);
        document.removeEventListener('keydown', key, true);
        document.documentElement.classList.remove('layout-dragging');
        if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
        end(initial, cancelled);
      };
      const up = () => finish(false),
        cancel = () => finish(true);
      const key = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          cancel();
        }
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', cancel);
      handle.addEventListener('lostpointercapture', cancel);
      document.addEventListener('keydown', key, true);
    });
  }
  function floating(
    panel,
    { key, title, header, enabled = () => innerWidth >= 900, onChange = () => {} } = {}
  ) {
    const bounds = () => {
      const v = viewport();
      const bar = document.querySelector('.ui-header, .topbar');
      const top = bar && visible(bar) ? Math.max(v.y, bar.getBoundingClientRect().bottom + 8) : v.y;
      v.height = Math.max(1, v.height - (top - v.y));
      v.y = top;
      return v;
    };
    let geometry = read(key);
    if (!geometry || !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(geometry[k])))
      geometry = null;
    const natural = () => {
      const r = panel.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };
    const apply = () => {
      panel.classList.toggle('layout-adjusted', !!geometry && enabled());
      onChange(!!geometry && enabled());
      if (!geometry || !enabled() || !visible(panel)) return;
      const v = bounds();
      const width = clamp(geometry.width, Math.min(260, v.width), v.width);
      const height = clamp(geometry.height, Math.min(160, v.height), v.height);
      const values = {
        x: clamp(geometry.x, v.x, v.x + v.width - width),
        y: clamp(geometry.y, v.y, v.y + v.height - height),
        width,
        height,
      };
      for (const [name, value] of Object.entries(values))
        panel.style.setProperty('--panel-' + name, value + 'px');
    };
    const reset = () => {
      geometry = null;
      save(key, null);
      apply();
    };
    resets.add(reset);
    function install() {
      if (panel.querySelector('.layout-panel-tools')) return;
      const host = header ? panel.querySelector(header) : panel;
      if (!host || !panel.children.length) return;
      const controls = document.createElement('div');
      controls.className = 'layout-panel-tools';
      for (const action of ['Move', 'Resize', 'Reset']) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = action;
        b.setAttribute('aria-label', action + ' ' + title);
        b.title =
          action === 'Reset'
            ? 'Restore default position and size'
            : action + ': drag or use arrow keys; Shift for larger steps';
        controls.append(b);
        if (action === 'Reset') {
          b.onclick = reset;
          continue;
        }
        b.className = 'layout-' + action.toLowerCase();
        const change = (initial, dx, dy) => {
          const v = bounds();
          geometry =
            action === 'Move'
              ? {
                  width: initial.width,
                  height: initial.height,
                  x: clamp(initial.x + dx, v.x, v.x + v.width - initial.width),
                  y: clamp(initial.y + dy, v.y, v.y + v.height - initial.height),
                }
              : {
                  x: initial.x,
                  y: initial.y,
                  width: clamp(
                    initial.width + dx,
                    Math.min(260, v.width),
                    v.x + v.width - initial.x
                  ),
                  height: clamp(
                    initial.height + dy,
                    Math.min(160, v.height),
                    v.y + v.height - initial.y
                  ),
                };
          apply();
        };
        gesture(
          b,
          () => (enabled() ? { ...natural(), previous: geometry } : null),
          change,
          (initial, cancelled) => {
            if (cancelled) geometry = initial.previous;
            save(key, geometry);
            apply();
          }
        );
        b.addEventListener('keydown', (e) => {
          if (
            !enabled() ||
            !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key)
          )
            return;
          e.preventDefault();
          e.stopPropagation();
          if (e.key === 'Home') return reset();
          const step = e.shiftKey ? 40 : 10;
          change(
            natural(),
            e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0,
            e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0
          );
          save(key, geometry);
        });
      }
      if (header) host.append(controls);
      else host.prepend(controls);
    }
    const update = () => {
      install();
      apply();
    };
    panel.classList.add('layout-floating');
    watch(panel, update);
    if (panel.parentElement)
      new MutationObserver(refresh).observe(panel.parentElement, {
        attributes: true,
        attributeFilter: ['class', 'hidden'],
      });
    update();
  }
  function splitter({
    container,
    panel,
    key,
    property,
    title,
    side = 'right',
    limits,
    enabled = () => innerWidth >= 900,
  }) {
    const handle = document.createElement('div');
    handle.className = 'layout-splitter';
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-label', title);
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-controls', panel.id);
    handle.title = title + ': drag or use Left/Right arrows; Home resets';
    container.append(handle);
    const stored = read(key);
    if (Number.isFinite(stored)) container.style.setProperty(property, stored + 'px');
    const reset = () => {
      container.style.removeProperty(property);
      save(key, null);
      refresh();
    };
    resets.add(reset);
    const set = (value) => {
      const [min, max] = limits();
      container.style.setProperty(property, clamp(value, min, max) + 'px');
      refresh();
    };
    const update = () => {
      handle.hidden = !enabled() || !visible(panel);
      if (handle.hidden) return;
      const r = panel.getBoundingClientRect(),
        c = container.getBoundingClientRect();
      handle.style.left = (side === 'right' ? r.right : r.left) - c.left - 5 + 'px';
      handle.setAttribute('aria-valuemin', String(Math.round(limits()[0])));
      handle.setAttribute('aria-valuemax', String(Math.round(limits()[1])));
      handle.setAttribute('aria-valuenow', String(Math.round(r.width)));
      handle.setAttribute('aria-valuetext', Math.round(r.width) + ' pixels');
    };
    gesture(
      handle,
      () =>
        enabled()
          ? {
              width: panel.getBoundingClientRect().width,
              previous: container.style.getPropertyValue(property),
            }
          : null,
      (initial, dx) => set(initial.width + (side === 'right' ? dx : -dx)),
      (initial, cancelled) => {
        if (cancelled) {
          if (initial.previous) container.style.setProperty(property, initial.previous);
          else container.style.removeProperty(property);
        } else save(key, panel.getBoundingClientRect().width);
        refresh();
      }
    );
    handle.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      if (e.key === 'Home') return reset();
      set(
        e.key === 'End'
          ? limits()[1]
          : panel.getBoundingClientRect().width +
              (e.key === 'ArrowRight' ? 1 : -1) *
                (side === 'right' ? 1 : -1) *
                (e.shiftKey ? 40 : 10)
      );
      save(key, parseFloat(container.style.getPropertyValue(property)));
    });
    handle.addEventListener('dblclick', reset);
    watch(container, update, [panel]);
    update();
    return handle;
  }
  return {
    anchor,
    floating,
    splitter,
    tooltips,
    refresh,
    reset: () => resets.forEach((reset) => reset()),
  };
})();
