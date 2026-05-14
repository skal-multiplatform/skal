// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var z = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Kt(this.context.count);
  }, getNextContextId() {
    return Kt(this.context.count++);
  } };
  function Kt(t) {
    const e = String(t), n = e.length - 1;
    return z.context.id + (n ? String.fromCharCode(96 + n) : "") + e;
  }
  function zt(t) {
    z.context = t;
  }
  function me() {
    return { ...z.context, id: z.getNextContextId(), count: 0 };
  }
  var Ce = (t, e) => t === e, xt = Symbol("solid-proxy"), Fe = typeof Proxy == "function", Ne = Symbol("solid-track"), dt = { equals: Ce }, Qt = null, xe = se, B = 1, st = 2, Zt = { owned: null, cleanups: null, context: null, owner: null }, b = null, u = null, ot = null, Q = null, R = null, C = null, L = null, Et = 0;
  function St(t, e) {
    const n = R, r = b, i = t.length === 0, o = e === undefined ? r : e, f = i ? Zt : { owned: null, cleanups: null, context: o ? o.context : null, owner: o }, h = i ? t : () => t(() => Z(() => Y(f)));
    b = f, R = null;
    try {
      return M(h, true);
    } finally {
      R = n, b = r;
    }
  }
  function W(t, e) {
    e = e ? Object.assign({}, dt, e) : dt;
    const n = { value: t, observers: null, observerSlots: null, comparator: e.equals || undefined }, r = (i) => (typeof i == "function" && (u && u.running && u.sources.has(n) ? i = i(n.tValue) : i = i(n.value)), ne(n, i));
    return [ee.bind(n), r];
  }
  function $(t, e, n) {
    const r = ie(t, e, false, B);
    ot && u && u.running ? C.push(r) : pt(r);
  }
  function Ot(t, e, n) {
    n = n ? Object.assign({}, dt, n) : dt;
    const r = ie(t, e, true, 0);
    return r.observers = null, r.observerSlots = null, r.comparator = n.equals || undefined, ot && u && u.running ? (r.tState = B, C.push(r)) : pt(r), ee.bind(r);
  }
  function Z(t) {
    if (!Q && R === null)
      return t();
    const e = R;
    R = null;
    try {
      return Q ? Q.untrack(t) : t();
    } finally {
      R = e;
    }
  }
  function Jt(t) {
    return b === null || (b.cleanups === null ? b.cleanups = [t] : b.cleanups.push(t)), t;
  }
  function Le(t) {
    if (u && u.running)
      return t(), u.done;
    const e = R, n = b;
    return Promise.resolve().then(() => {
      R = e, b = n;
      let r;
      return (ot || De) && (r = u || (u = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), r.done || (r.done = new Promise((i) => r.resolve = i)), r.running = true), M(t, false), R = b = null, r ? r.done : undefined;
    });
  }
  var [nr, te] = W(false), De;
  function ee() {
    const t = u && u.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === B)
        pt(this);
      else {
        const e = C;
        C = null, M(() => wt(this), false), C = e;
      }
    if (R) {
      const e = this.observers ? this.observers.length : 0;
      R.sources ? (R.sources.push(this), R.sourceSlots.push(e)) : (R.sources = [this], R.sourceSlots = [e]), this.observers ? (this.observers.push(R), this.observerSlots.push(R.sources.length - 1)) : (this.observers = [R], this.observerSlots = [R.sources.length - 1]);
    }
    return t && u.sources.has(this) ? this.tValue : this.value;
  }
  function ne(t, e, n) {
    let r = u && u.running && u.sources.has(t) ? t.tValue : t.value;
    if (!t.comparator || !t.comparator(r, e)) {
      if (u) {
        const i = u.running;
        (i || !n && u.sources.has(t)) && (u.sources.add(t), t.tValue = e), i || (t.value = e);
      } else
        t.value = e;
      t.observers && t.observers.length && M(() => {
        for (let i = 0;i < t.observers.length; i += 1) {
          const o = t.observers[i], f = u && u.running;
          f && u.disposed.has(o) || ((f ? !o.tState : !o.state) && (o.pure ? C.push(o) : L.push(o), o.observers && oe(o)), f ? o.tState = B : o.state = B);
        }
        if (C.length > 1e6)
          throw C = [], new Error;
      }, false);
    }
    return e;
  }
  function pt(t) {
    if (!t.fn)
      return;
    Y(t);
    const e = Et;
    re(t, u && u.running && u.sources.has(t) ? t.tValue : t.value, e), u && !u.running && u.sources.has(t) && queueMicrotask(() => {
      M(() => {
        u && (u.running = true), R = b = t, re(t, t.tValue, e), R = b = null;
      }, false);
    });
  }
  function re(t, e, n) {
    let r;
    const i = b, o = R;
    R = b = t;
    try {
      r = t.fn(e);
    } catch (f) {
      return t.pure && (u && u.running ? (t.tState = B, t.tOwned && t.tOwned.forEach(Y), t.tOwned = undefined) : (t.state = B, t.owned && t.owned.forEach(Y), t.owned = null)), t.updatedAt = n + 1, Dt(f);
    } finally {
      R = o, b = i;
    }
    (!t.updatedAt || t.updatedAt <= n) && (t.updatedAt != null && ("observers" in t) ? ne(t, r, true) : u && u.running && t.pure ? (u.sources.has(t) || (t.value = r), u.sources.add(t), t.tValue = r) : t.value = r, t.updatedAt = n);
  }
  function ie(t, e, n, r = B, i) {
    const o = { fn: t, state: r, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: e, owner: b, context: b ? b.context : null, pure: n };
    if (u && u.running && (o.state = 0, o.tState = r), b === null || b !== Zt && (u && u.running && b.pure ? b.tOwned ? b.tOwned.push(o) : b.tOwned = [o] : b.owned ? b.owned.push(o) : b.owned = [o]), Q && o.fn) {
      const f = o.fn, [h, O] = W(undefined, { equals: false }), d = Q.factory(f, O);
      Jt(() => d.dispose());
      let w;
      const c = () => Le(O).then(() => {
        w && (w.dispose(), w = undefined);
      });
      o.fn = (A) => (h(), u && u.running ? (w || (w = Q.factory(f, c)), w.track(A)) : d.track(A));
    }
    return o;
  }
  function Lt(t) {
    const e = u && u.running;
    if ((e ? t.tState : t.state) === 0)
      return;
    if ((e ? t.tState : t.state) === st)
      return wt(t);
    if (t.suspense && Z(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const n = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < Et); ) {
      if (e && u.disposed.has(t))
        return;
      (e ? t.tState : t.state) && n.push(t);
    }
    for (let r = n.length - 1;r >= 0; r--) {
      if (t = n[r], e) {
        let i = t, o = n[r + 1];
        for (;(i = i.owner) && i !== o; )
          if (u.disposed.has(i))
            return;
      }
      if ((e ? t.tState : t.state) === B)
        pt(t);
      else if ((e ? t.tState : t.state) === st) {
        const i = C;
        C = null, M(() => wt(t, n[0]), false), C = i;
      }
    }
  }
  function M(t, e) {
    if (C)
      return t();
    let n = false;
    e || (C = []), L ? n = true : L = [], Et++;
    try {
      const r = t();
      return ke(n), r;
    } catch (r) {
      n || (L = null), C = null, Dt(r);
    }
  }
  function ke(t) {
    if (C && (ot && u && u.running ? He(C) : se(C), C = null), t)
      return;
    let e;
    if (u) {
      if (!u.promises.size && !u.queue.size) {
        const { sources: r, disposed: i } = u;
        L.push.apply(L, u.effects), e = u.resolve;
        for (const o of L)
          "tState" in o && (o.state = o.tState), delete o.tState;
        u = null, M(() => {
          for (const o of i)
            Y(o);
          for (const o of r) {
            if (o.value = o.tValue, o.owned)
              for (let f = 0, h = o.owned.length;f < h; f++)
                Y(o.owned[f]);
            o.tOwned && (o.owned = o.tOwned), delete o.tValue, delete o.tOwned, o.tState = 0;
          }
          te(false);
        }, false);
      } else if (u.running) {
        u.running = false, u.effects.push.apply(u.effects, L), L = null, te(true);
        return;
      }
    }
    const n = L;
    L = null, n.length && M(() => xe(n), false), e && e();
  }
  function se(t) {
    for (let e = 0;e < t.length; e++)
      Lt(t[e]);
  }
  function He(t) {
    for (let e = 0;e < t.length; e++) {
      const n = t[e], r = u.queue;
      r.has(n) || (r.add(n), ot(() => {
        r.delete(n), M(() => {
          u.running = true, Lt(n);
        }, false), u && (u.running = false);
      }));
    }
  }
  function wt(t, e) {
    const n = u && u.running;
    n ? t.tState = 0 : t.state = 0;
    for (let r = 0;r < t.sources.length; r += 1) {
      const i = t.sources[r];
      if (i.sources) {
        const o = n ? i.tState : i.state;
        o === B ? i !== e && (!i.updatedAt || i.updatedAt < Et) && Lt(i) : o === st && wt(i, e);
      }
    }
  }
  function oe(t) {
    const e = u && u.running;
    for (let n = 0;n < t.observers.length; n += 1) {
      const r = t.observers[n];
      (e ? !r.tState : !r.state) && (e ? r.tState = st : r.state = st, r.pure ? C.push(r) : L.push(r), r.observers && oe(r));
    }
  }
  function Y(t) {
    let e;
    if (t.sources)
      for (;t.sources.length; ) {
        const n = t.sources.pop(), r = t.sourceSlots.pop(), i = n.observers;
        if (i && i.length) {
          const o = i.pop(), f = n.observerSlots.pop();
          r < i.length && (o.sourceSlots[f] = r, i[r] = o, n.observerSlots[r] = f);
        }
      }
    if (t.tOwned) {
      for (e = t.tOwned.length - 1;e >= 0; e--)
        Y(t.tOwned[e]);
      delete t.tOwned;
    }
    if (u && u.running && t.pure)
      le(t, true);
    else if (t.owned) {
      for (e = t.owned.length - 1;e >= 0; e--)
        Y(t.owned[e]);
      t.owned = null;
    }
    if (t.cleanups) {
      for (e = t.cleanups.length - 1;e >= 0; e--)
        t.cleanups[e]();
      t.cleanups = null;
    }
    u && u.running ? t.tState = 0 : t.state = 0;
  }
  function le(t, e) {
    if (e || (t.tState = 0, u.disposed.add(t)), t.owned)
      for (let n = 0;n < t.owned.length; n++)
        le(t.owned[n]);
  }
  function Be(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function ae(t, e, n) {
    try {
      for (const r of e)
        r(t);
    } catch (r) {
      Dt(r, n && n.owner || null);
    }
  }
  function Dt(t, e = b) {
    const n = Qt && e && e.context && e.context[Qt], r = Be(t);
    if (!n)
      throw r;
    L ? L.push({ fn() {
      ae(r, n, e);
    }, state: B }) : ae(r, n, e);
  }
  var We = Symbol("fallback");
  function ue(t) {
    for (let e = 0;e < t.length; e++)
      t[e]();
  }
  function Ve(t, e, n = {}) {
    let r = [], i = [], o = [], f = 0, h = e.length > 1 ? [] : null;
    return Jt(() => ue(o)), () => {
      let O = t() || [], d = O.length, w, c;
      return O[Ne], Z(() => {
        let I, y, E, x, D, a, l, s, g;
        if (d === 0)
          f !== 0 && (ue(o), o = [], r = [], i = [], f = 0, h && (h = [])), n.fallback && (r = [We], i[0] = St((p) => (o[0] = p, n.fallback())), f = 1);
        else if (f === 0) {
          for (i = new Array(d), c = 0;c < d; c++)
            r[c] = O[c], i[c] = St(A);
          f = d;
        } else {
          for (E = new Array(d), x = new Array(d), h && (D = new Array(d)), a = 0, l = Math.min(f, d);a < l && r[a] === O[a]; a++)
            ;
          for (l = f - 1, s = d - 1;l >= a && s >= a && r[l] === O[s]; l--, s--)
            E[s] = i[l], x[s] = o[l], h && (D[s] = h[l]);
          for (I = new Map, y = new Array(s + 1), c = s;c >= a; c--)
            g = O[c], w = I.get(g), y[c] = w === undefined ? -1 : w, I.set(g, c);
          for (w = a;w <= l; w++)
            g = r[w], c = I.get(g), c !== undefined && c !== -1 ? (E[c] = i[w], x[c] = o[w], h && (D[c] = h[w]), c = y[c], I.set(g, c)) : o[w]();
          for (c = a;c < d; c++)
            c in E ? (i[c] = E[c], o[c] = x[c], h && (h[c] = D[c], h[c](c))) : i[c] = St(A);
          i = i.slice(0, f = d), r = O.slice(0);
        }
        return i;
      });
      function A(I) {
        if (o[c] = I, h) {
          const [y, E] = W(c);
          return h[c] = E, e(O[c], y);
        }
        return e(O[c]);
      }
    };
  }
  var Ge = false;
  function Ue(t, e) {
    if (Ge && z.context) {
      const n = z.context;
      zt(me());
      const r = Z(() => t(e || {}));
      return zt(n), r;
    }
    return Z(() => t(e || {}));
  }
  function Pt() {
    return true;
  }
  var Me = { get(t, e, n) {
    return e === xt ? n : t.get(e);
  }, has(t, e) {
    return e === xt ? true : t.has(e);
  }, set: Pt, deleteProperty: Pt, getOwnPropertyDescriptor(t, e) {
    return { configurable: true, enumerable: true, get() {
      return t.get(e);
    }, set: Pt, deleteProperty: Pt };
  }, ownKeys(t) {
    return t.keys();
  } };
  function kt(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function $e() {
    for (let t = 0, e = this.length;t < e; ++t) {
      const n = this[t]();
      if (n !== undefined)
        return n;
    }
  }
  function fe(...t) {
    let e = false;
    for (let f = 0;f < t.length; f++) {
      const h = t[f];
      e = e || !!h && xt in h, t[f] = typeof h == "function" ? (e = true, Ot(h)) : h;
    }
    if (Fe && e)
      return new Proxy({ get(f) {
        for (let h = t.length - 1;h >= 0; h--) {
          const O = kt(t[h])[f];
          if (O !== undefined)
            return O;
        }
      }, has(f) {
        for (let h = t.length - 1;h >= 0; h--)
          if (f in kt(t[h]))
            return true;
        return false;
      }, keys() {
        const f = [];
        for (let h = 0;h < t.length; h++)
          f.push(...Object.keys(kt(t[h])));
        return [...new Set(f)];
      } }, Me);
    const n = {}, r = Object.create(null);
    for (let f = t.length - 1;f >= 0; f--) {
      const h = t[f];
      if (!h)
        continue;
      const O = Object.getOwnPropertyNames(h);
      for (let d = O.length - 1;d >= 0; d--) {
        const w = O[d];
        if (w === "__proto__" || w === "constructor")
          continue;
        const c = Object.getOwnPropertyDescriptor(h, w);
        if (!r[w])
          r[w] = c.get ? { enumerable: true, configurable: true, get: $e.bind(n[w] = [c.get.bind(h)]) } : c.value !== undefined ? c : undefined;
        else {
          const A = n[w];
          A && (c.get ? A.push(c.get.bind(h)) : c.value !== undefined && A.push(() => c.value));
        }
      }
    }
    const i = {}, o = Object.keys(r);
    for (let f = o.length - 1;f >= 0; f--) {
      const h = o[f], O = r[h];
      O && O.get ? Object.defineProperty(i, h, O) : i[h] = O ? O.value : undefined;
    }
    return i;
  }
  function ce(t) {
    const e = "fallback" in t && { fallback: () => t.fallback };
    return Ot(Ve(() => t.each, t.children, e || undefined));
  }
  var Ye = (t) => Ot(() => t());
  function qe({ createElement: t, createTextNode: e, isTextNode: n, replaceText: r, insertNode: i, removeNode: o, setProperty: f, getParentNode: h, getFirstChild: O, getNextSibling: d }) {
    function w(a, l, s, g) {
      if (s !== undefined && !g && (g = []), typeof l != "function")
        return c(a, l, g, s);
      $((p) => c(a, l(), p, s), g);
    }
    function c(a, l, s, g, p) {
      for (;typeof s == "function"; )
        s = s();
      if (l === s)
        return s;
      const T = typeof l, S = g !== undefined;
      if (T === "string" || T === "number")
        if (T === "number" && (l = l.toString()), S) {
          let v = s[0];
          v && n(v) ? r(v, l) : v = e(l), s = y(a, s, g, v);
        } else
          s !== "" && typeof s == "string" ? r(O(a), s = l) : (y(a, s, g, e(l)), s = l);
      else if (l == null || T === "boolean")
        s = y(a, s, g);
      else {
        if (T === "function")
          return $(() => {
            let v = l();
            for (;typeof v == "function"; )
              v = v();
            s = c(a, v, s, g);
          }), () => s;
        if (Array.isArray(l)) {
          const v = [];
          if (A(v, l, p))
            return $(() => s = c(a, v, s, g, true)), () => s;
          if (v.length === 0) {
            const it = y(a, s, g);
            if (S)
              return s = it;
          } else
            Array.isArray(s) ? s.length === 0 ? E(a, v, g) : I(a, s, v) : s == null || s === "" ? E(a, v) : I(a, S && s || [O(a)], v);
          s = v;
        } else {
          if (Array.isArray(s)) {
            if (S)
              return s = y(a, s, g, l);
            y(a, s, null, l);
          } else
            s == null || s === "" || !O(a) ? i(a, l) : x(a, l, O(a));
          s = l;
        }
      }
      return s;
    }
    function A(a, l, s) {
      let g = false;
      for (let p = 0, T = l.length;p < T; p++) {
        let S = l[p], v;
        if (!(S == null || S === true || S === false))
          if (Array.isArray(S))
            g = A(a, S) || g;
          else if ((v = typeof S) == "string" || v === "number")
            a.push(e(S));
          else if (v === "function")
            if (s) {
              for (;typeof S == "function"; )
                S = S();
              g = A(a, Array.isArray(S) ? S : [S]) || g;
            } else
              a.push(S), g = true;
          else
            a.push(S);
      }
      return g;
    }
    function I(a, l, s) {
      let g = s.length, p = l.length, T = g, S = 0, v = 0, it = d(l[p - 1]), j = null;
      for (;S < p || v < T; ) {
        if (l[S] === s[v]) {
          S++, v++;
          continue;
        }
        for (;l[p - 1] === s[T - 1]; )
          p--, T--;
        if (p === S) {
          const U = T < g ? v ? d(s[v - 1]) : s[T - v] : it;
          for (;v < T; )
            i(a, s[v++], U);
        } else if (T === v)
          for (;S < p; )
            (!j || !j.has(l[S])) && o(a, l[S]), S++;
        else if (l[S] === s[T - 1] && s[v] === l[p - 1]) {
          const U = d(l[--p]);
          i(a, s[v++], d(l[S++])), i(a, s[--T], U), l[p] = s[T];
        } else {
          if (!j) {
            j = new Map;
            let K = v;
            for (;K < T; )
              j.set(s[K], K++);
          }
          const U = j.get(l[S]);
          if (U != null)
            if (v < U && U < T) {
              let K = S, jt = 1, Ie;
              for (;++K < p && K < T && !((Ie = j.get(l[K])) == null || Ie !== U + jt); )
                jt++;
              if (jt > U - v) {
                const er = l[S];
                for (;v < U; )
                  i(a, s[v++], er);
              } else
                x(a, s[v++], l[S++]);
            } else
              S++;
          else
            o(a, l[S++]);
        }
      }
    }
    function y(a, l, s, g) {
      if (s === undefined) {
        let T;
        for (;T = O(a); )
          o(a, T);
        return g && i(a, g), "";
      }
      const p = g || e("");
      if (l.length) {
        let T = false;
        for (let S = l.length - 1;S >= 0; S--) {
          const v = l[S];
          if (p !== v) {
            const it = h(v) === a;
            !T && !S ? it ? x(a, p, v) : i(a, p, s) : it && o(a, v);
          } else
            T = true;
        }
      } else
        i(a, p, s);
      return [p];
    }
    function E(a, l, s) {
      for (let g = 0, p = l.length;g < p; g++)
        i(a, l[g], s);
    }
    function x(a, l, s) {
      i(a, l, s), o(a, s);
    }
    function D(a, l, s = {}, g) {
      return l || (l = {}), g || $(() => s.children = c(a, l.children, s.children)), $(() => l.ref && l.ref(a)), $(() => {
        for (const p in l) {
          if (p === "children" || p === "ref")
            continue;
          const T = l[p];
          T !== s[p] && (f(a, p, T, s[p]), s[p] = T);
        }
      }), s;
    }
    return { render(a, l) {
      let s;
      return St((g) => {
        s = g, w(l, a());
      }), s;
    }, insert: w, spread(a, l, s) {
      typeof l == "function" ? $((g) => D(a, l(), g, s)) : D(a, l, undefined, s);
    }, createElement: t, createTextNode: e, insertNode: i, setProp(a, l, s, g) {
      return f(a, l, s, g), s;
    }, mergeProps: fe, effect: $, memo: Ye, createComponent: Ue, use(a, l, s) {
      return Z(() => a(l, s));
    } };
  }
  function Xe(t) {
    const e = qe(t);
    return e.mergeProps = fe, e;
  }
  var he = 6 * 1024 * 1024, je = 64, rr = je, ge = 4 * 1024 * 1024, J = 64 + ge, Ht = 1024 * 1024, Bt = J + Ht, _e = J + Ht, Ke = 0, ze = 8, Qe = 12, Ze = 16, Je = 24, tn = 28, en = 32, nn = ze >> 2, rn = Qe >> 2, sn = Je >> 2, ve = tn >> 2, on = Ke >> 3, ln = Ze >> 3, an = en >> 3, ir = 1, sr = 2, or = 3, lr = 4, ar = 16, ur = 17, fr = 20, cr = 21, hr = 22, gr = 23, _r = 24, vr = 25, dr = 26, Er = 27, Sr = 32, Or = 33, pr = 34, wr = 35, Pr = 36, Tr = 37, br = 0, Rr = 1, yr = 2, Ar = 3, Ir = 4, mr = 5, Cr = 6, Fr = 7, Nr = 1, xr = 0, Lr = 1, Dr = 2, kr = 3, Hr = 4, Br = 5, Wr = 6, Vr = 7, Gr = 8, Ur = 9, Mr = 32, $r = 33, Yr = 34, qr = 35, Xr = 36, jr = 37, Kr = 64, zr = 65, Qr = 66, Zr = 67, Jr = 68, ti = 69, ei = 70, ni = 96, ri = 97, ii = 128, si = 129, oi = 130, li = 131, ai = 160, ui = 161, fi = 162, ci = -1, un = 2147483646, fn = 2147483645, X = globalThis.__skal_acquireBridge();
  if (!X || X.byteLength !== he)
    throw new Error(`Skal: bridge buffer not available (got ${X && X.byteLength})`);
  var cn = new Uint8Array(X), V = new Uint32Array(X), Wt = new BigInt64Array(X), hn = new TextEncoder, lt = 16, gn = 64 + ge >> 2, _n = 16384, vn = gn - 4, Tt = 0n, q = lt, tt = J, bt = lt;
  function Vt() {
    V[nn] = q - lt << 2, V[rn] = tt - J, Tt += 1n, Atomics.store(Wt, on, Tt), bt = q;
  }
  function de() {
    Vt();
    const t = Tt, e = performance.now() + 5000;
    for (;!(Atomics.load(Wt, an) >= t); )
      if (performance.now() > e) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    q = lt, tt = J, bt = lt;
  }
  function F(t, e, n, r) {
    let i = q;
    i >= vn && (de(), i = q), V[i] = t >>> 0, V[i + 1] = e >>> 0, V[i + 2] = n >>> 0, V[i + 3] = r >>> 0, q = i + 4, q - bt >= _n && Vt();
  }
  var at = 0, ut = 0;
  function Rt(t) {
    tt + t.length * 3 > _e && de();
    const e = tt - J, n = cn.subarray(tt, _e), { read: r, written: i } = hn.encodeInto(t, n);
    if (r !== t.length)
      throw new Error(`Skal: string too large for heap (${t.length} code units > ${Ht} bytes)`);
    tt += i, at = e, ut = i;
  }
  function Gt(t, e) {
    Rt(e), F(20, t, at, ut);
  }
  var Ut = false;
  function dn() {
    Ut = false, q !== bt && Vt();
  }
  function m() {
    Ut || (Ut = true, queueMicrotask(dn));
  }
  var G = 1024, P = new Int8Array(256);
  P.fill(-1), P[0] = 0, P[1] = 1, P[2] = 2, P[3] = 3, P[4] = 4, P[5] = 5, P[6] = 6, P[7] = 7, P[8] = 8, P[9] = 9, P[32] = 10, P[33] = 11, P[34] = 12, P[35] = 13, P[36] = 14, P[37] = 15, P[64] = 16, P[65] = 17, P[66] = 18, P[67] = 19, P[68] = 20, P[69] = 21, P[70] = 22, P[96] = 23, P[97] = 24, P[128] = 25, P[129] = 26, P[130] = 27, P[131] = 28, P[160] = 29, P[161] = 30, P[162] = 31;
  var k = 32, yt = new Int32Array(G * k), ft = new Float32Array(G * k), At = new Array(G * k), ct = new Uint8Array(G * k), et = 6, nt = new Float32Array(G * et);
  nt.fill(NaN);
  var It = new Map, Ee = [], En = 0;
  function Sn() {
    const t = G * 2, e = G * k, n = t * k, r = G * et, i = t * et, o = new Int32Array(n);
    o.set(yt), yt = o;
    const f = new Uint8Array(n);
    f.set(ct), ct = f;
    const h = new Float32Array(n);
    h.set(ft), h.fill(NaN, e), ft = h;
    const O = new Float32Array(i);
    O.set(nt), O.fill(NaN, r), nt = O, At.length = n, G = t;
  }
  function mt(t) {
    let e = It.get(t);
    if (e === undefined) {
      e = Ee.pop(), e === undefined && (e = En++), e >= G && Sn(), It.set(t, e);
      const n = e * k;
      ct.fill(0, n, n + k), ft.fill(NaN, n, n + k);
      for (let r = n;r < n + k; r++)
        At[r] = undefined;
    }
    return e;
  }
  function On(t) {
    const e = It.get(t);
    if (e !== undefined) {
      It.delete(t), Ee.push(e);
      const n = e * et;
      nt.fill(NaN, n, n + et);
    }
  }
  var ht = 0, gt = 0, Mt = new Float32Array(1), $t = new Uint32Array(Mt.buffer);
  function Ct(t, e, n) {
    const r = P[e];
    if (r < 0)
      return;
    const i = mt(t) * k + r, o = n | 0;
    if (ct[i] !== 0 && yt[i] === o) {
      gt++;
      return;
    }
    yt[i] = o, ct[i] = 1, F(16, t, e, o), ht++;
  }
  function pn(t, e, n) {
    const r = P[e];
    if (r < 0)
      return;
    const i = mt(t) * k + r;
    if (ft[i] === n) {
      gt++;
      return;
    }
    ft[i] = n, Mt[0] = n, F(17, t, e, $t[0]), ht++;
  }
  function wn(t, e, n) {
    const r = P[e];
    if (r < 0)
      return;
    const i = mt(t) * k + r;
    if (At[i] === n) {
      gt++;
      return;
    }
    At[i] = n, Rt(n == null ? "" : String(n)), F(22, t, (e & 255) << 24 | at & 16777215, ut), ht++;
  }
  function rt(t, e, n, r) {
    const i = mt(t) * et + n;
    if (nt[i] === r) {
      gt++;
      return;
    }
    nt[i] = r, Mt[0] = r, F(e, t, 0, $t[0]), ht++;
  }
  function Pn(t, e) {
    rt(t, 32, 0, e);
  }
  function Tn(t, e) {
    rt(t, 33, 1, e);
  }
  function bn(t, e) {
    rt(t, 34, 2, e);
  }
  function Rn(t, e) {
    rt(t, 35, 3, e);
  }
  function yn(t, e) {
    rt(t, 36, 4, e);
  }
  function An(t, e) {
    rt(t, 37, 5, e);
  }
  var Se = new Map;
  function In(t) {
    let e = 2166136261;
    for (let n = 0;n < t.length; n++)
      e ^= t.charCodeAt(n), e = Math.imul(e, 16777619) >>> 0;
    return e;
  }
  function _t(t) {
    let e = Se.get(t);
    return e !== undefined || (e = In(t), Rt(t), F(23, e, at, ut), Se.set(t, e)), e;
  }
  function mn(t, e) {
    F(4, t, _t(e), 0);
  }
  function Oe(t, e, n) {
    F(24, t, _t(e), n >>> 0);
  }
  function Cn(t, e, n) {
    const r = _t(e);
    _f32view[0] = n, F(25, t, r, $t[0]);
  }
  function Fn(t, e, n) {
    const r = _t(e);
    Rt(n == null ? "" : String(n));
    const i = at & 16777215, o = ut & 255;
    F(26, t, r, i << 8 | o);
  }
  function Nn(t, e, n) {
    F(27, t, _t(e), n);
  }
  var Yt = new Map, xn = 1;
  function pe(t) {
    const e = xn++;
    return Yt.set(e, t), e;
  }
  function Ln(t, e, n) {
    F(21, t, e, n);
  }
  var qt = 0n, we = null, Pe = he - Bt, Xt = Bt >> 2, Dn = Bt + Pe >> 2, kn = Pe / 16 | 0;
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load(Wt, ln);
    if (t === qt)
      return;
    const e = Xt + (V[sn] >> 2);
    let n = Xt + (V[ve] >> 2);
    const r = Dn, i = Xt;
    let o = kn;
    for (;n !== e && o-- > 0; ) {
      const f = V[n + 1], h = Yt.get(f);
      if (h)
        try {
          h();
        } catch (O) {
          we = O && (O.stack || O.message || String(O)) || "unknown";
        }
      n += 4, n >= r && (n = i);
    }
    V[ve] = n - i << 2, qt = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: Yt.size, opSeq: Number(Tt), lastEventSeq: Number(qt), lastHandlerError: we, propWrites: ht, propSkips: gt });
  var hi = 1, Hn = 2;
  function Te() {
    return Hn++;
  }
  var Bn = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4 }, Wn = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"] }, Vn = { opacity: Pn, translationX: Tn, translationY: bn, scaleX: Rn, scaleY: yn, rotation: An };
  function Gn(t) {
    if (typeof t == "number")
      return t | 0;
    if (typeof t != "string")
      return 0;
    let e = t.trim();
    e.startsWith("#") && (e = e.slice(1));
    let n = 0, r = 0, i = 0, o = 255;
    return e.length === 3 ? (n = parseInt(e[0] + e[0], 16), r = parseInt(e[1] + e[1], 16), i = parseInt(e[2] + e[2], 16)) : e.length === 4 ? (n = parseInt(e[0] + e[0], 16), r = parseInt(e[1] + e[1], 16), i = parseInt(e[2] + e[2], 16), o = parseInt(e[3] + e[3], 16)) : e.length === 6 ? (n = parseInt(e.slice(0, 2), 16), r = parseInt(e.slice(2, 4), 16), i = parseInt(e.slice(4, 6), 16)) : e.length === 8 && (o = parseInt(e.slice(0, 2), 16), n = parseInt(e.slice(2, 4), 16), r = parseInt(e.slice(4, 6), 16), i = parseInt(e.slice(6, 8), 16)), (o & 255) << 24 | (n & 255) << 16 | (r & 255) << 8 | i & 255 | 0;
  }
  function Un(t) {
    return typeof t == "number" ? t | 0 : t === "fill" ? un : t === "wrap" ? fn : -1;
  }
  function Mn(t, e, n) {
    if (n == null)
      return;
    const r = typeof n;
    if (r === "function") {
      const i = pe(n);
      Nn(t.id, e, i), m();
      return;
    }
    if (r === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 ? Oe(t.id, e, n | 0) : Cn(t.id, e, n), m();
      return;
    }
    if (r === "string") {
      Fn(t.id, e, n), m();
      return;
    }
    if (r === "boolean") {
      Oe(t.id, e, n ? 1 : 0), m();
      return;
    }
  }
  function $n(t) {
    const e = [t];
    for (;e.length > 0; ) {
      const n = e.pop();
      On(n.id);
      let r = n.firstChild;
      for (;r; )
        e.push(r), r = r.nextSibling;
    }
  }
  var Ft = class {
    constructor(t, e, n = false, r = false) {
      this.tag = t, this.id = e, this.isText = n, this.isCustom = r, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, Yn = Xe({ createElement(t) {
    const e = Te(), n = Bn[t];
    return n !== undefined ? (F(1, e, n, 0), m(), new Ft(t, e, false, false)) : (mn(e, t), m(), new Ft(t, e, false, true));
  }, createTextNode(t) {
    const e = Te();
    F(1, e, 3, 0);
    const n = t == null ? "" : String(t);
    n.length > 0 && Gt(e, n), m();
    const r = new Ft("#text", e, true);
    return r.text = n, r;
  }, replaceText(t, e) {
    const n = e == null ? "" : String(e);
    t.text !== n && (t.text = n, Gt(t.id, n), m());
  }, setProperty(t, e, n, r) {
    if (t.isCustom) {
      Mn(t, e, n);
      return;
    }
    if (e === "onClick" || e === "onclick") {
      if (typeof n == "function") {
        const f = pe(n);
        Ln(t.id, 1, f), m();
      }
      return;
    }
    if (e === "label" && (t.tag === "button" || t.tag === "text")) {
      const f = n == null ? "" : String(n);
      Gt(t.id, f), m();
      return;
    }
    const i = Vn[e];
    if (i !== undefined) {
      typeof n == "number" && (i(t.id, n), m());
      return;
    }
    const o = Wn[e];
    if (o !== undefined) {
      const [f, h] = o;
      if (n == null)
        return;
      switch (h) {
        case "u32":
          typeof n == "number" ? (Ct(t.id, f, n | 0), m()) : typeof n == "boolean" && (Ct(t.id, f, n ? 1 : 0), m());
          return;
        case "f32":
          typeof n == "number" && (pn(t.id, f, n), m());
          return;
        case "str":
          wn(t.id, f, String(n)), m();
          return;
        case "color":
          Ct(t.id, f, Gn(n)), m();
          return;
        case "dim":
          Ct(t.id, f, Un(n)), m();
          return;
      }
      return;
    }
    if (e === "style" && n && typeof n == "object") {
      for (const f in n)
        this.setProperty(t, f, n[f]);
      return;
    }
  }, insertNode(t, e, n) {
    const r = n ? n.id : 0;
    F(3, t.id, e.id, r), m(), e.parent = t, n ? (e.nextSibling = n, e.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = e : t.firstChild = e, n.prevSibling = e) : (e.prevSibling = t.lastChild, e.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = e : t.firstChild = e, t.lastChild = e);
  }, removeNode(t, e) {
    F(2, e.id, 0, 0), $n(e), m(), e.prevSibling ? e.prevSibling.nextSibling = e.nextSibling : t.firstChild = e.nextSibling, e.nextSibling ? e.nextSibling.prevSibling = e.prevSibling : t.lastChild = e.prevSibling, e.parent = null, e.prevSibling = null, e.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: qn, effect: Xn, memo: gi, createComponent: Nt, createElement: N, createTextNode: _i, insertNode: H, insert: vt, spread: vi, setProp: _, mergeProps: di, use: Ei } = Yn;
  F(1, 1, 0, 0), m();
  var jn = new Ft("box", 1, false), be = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], Kn = Array.from({ length: 15000 }, (t, e) => ({ author: `@user${e * 2654435761 >>> 17}`, body: be[e % be.length], num: e + 1 })), zn = [50, 200, 500, 1000, 2000, 5000, 1e4], Re = "#FFF1F5F9", ye = "#FF475569", Qn = "#FF22C55E", Zn = "#FFEF4444", Ae = "#FFFFFFFF";
  function Jn(t) {
    const [e, n] = W(0), [r, i] = W(false), [o, f] = W(0), [h, O] = W(false);
    return (() => {
      var d = N("column"), w = N("text"), c = N("text"), A = N("row"), I = N("button"), y = N("button");
      return H(d, w), H(d, c), H(d, A), _(d, "background", "#FFFFFFFF"), _(d, "padding", 12), _(d, "cornerRadius", 10), _(d, "borderWidth", 1), _(d, "borderColor", "#FFE5E5EA"), _(d, "gap", 6), _(w, "fontWeight", 700), _(w, "fontSize", 14), _(w, "color", "#FF1DA1F2"), _(c, "fontSize", 14), _(c, "color", "#FF1F2937"), _(c, "maxLines", 3), _(c, "textOverflow", 1), H(A, I), H(A, y), _(A, "gap", 10), _(I, "fontSize", 12), _(I, "padding", 6), _(I, "cornerRadius", 16), _(I, "onClick", () => {
        const E = !r();
        i(E), n(e() + (E ? 1 : -1));
      }), _(y, "fontSize", 12), _(y, "padding", 6), _(y, "cornerRadius", 16), _(y, "onClick", () => {
        const E = !h();
        O(E), f(o() + (E ? 1 : -1));
      }), Xn((E) => {
        var x = `#${t.num} \xB7 ${t.author}`, D = t.body, a = `\u2665 ${e()}`, l = r() ? Qn : Re, s = r() ? Ae : ye, g = `\u21A9 ${o()}`, p = h() ? Zn : Re, T = h() ? Ae : ye;
        return x !== E.e && (E.e = _(w, "label", x, E.e)), D !== E.t && (E.t = _(c, "label", D, E.t)), a !== E.a && (E.a = _(I, "label", a, E.a)), l !== E.o && (E.o = _(I, "background", l, E.o)), s !== E.i && (E.i = _(I, "color", s, E.i)), g !== E.n && (E.n = _(y, "label", g, E.n)), p !== E.s && (E.s = _(y, "background", p, E.s)), T !== E.h && (E.h = _(y, "color", T, E.h)), E;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), d;
    })();
  }
  function tr() {
    const [t, e] = W(0), [n, r] = W("tap +1000 to benchmark fast-path"), [i, o] = W(50), [f, h] = W(""), O = Ot(() => Kn.slice(0, i()));
    return (() => {
      var d = N("listView"), w = N("greeting"), c = N("qrImageView"), A = N("box"), I = N("row"), y = N("button"), E = N("button"), x = N("button"), D = N("row");
      return H(d, w), H(d, c), H(d, A), H(d, I), H(d, x), H(d, D), _(d, "background", "#FFFAFAFA"), _(d, "padding", 16), _(d, "gap", 12), _(w, "name", "Skal"), _(w, "color", "#FF1DA1F2"), _(w, "fontSize", 20), _(c, "data", "https://skal.dev"), _(c, "size", 200), _(A, "background", "#FF1DA1F2"), _(A, "padding", 12), _(A, "cornerRadius", 8), vt(A, () => `Count: ${t()}`), H(I, y), H(I, E), _(I, "gap", 8), _(y, "label", "Increment"), _(y, "onClick", () => e(t() + 1)), _(E, "label", "Decrement"), _(E, "onClick", () => e(t() - 1)), _(x, "label", "+1000 (benchmark)"), _(x, "onClick", () => {
        const a = t(), l = performance.now();
        let s = 0, g = -1, p = "";
        try {
          for (;s < 1000; s++)
            e(t() + 1);
        } catch (v) {
          g = s, p = v && (v.message || String(v)) || "unknown";
        }
        const T = (performance.now() - l).toFixed(3), S = t() - a;
        g >= 0 ? r(`crashed @${g}: ${p} \xB7 delta=${S}`) : r(`+1000 ${T}ms \xB7 iter=${s} delta=${S}`);
      }), vt(d, n, D), vt(D, Nt(ce, { each: zn, children: (a) => (() => {
        var l = N("button");
        return _(l, "label", `${a}`), _(l, "onClick", () => {
          const s = performance.now();
          try {
            o(a), h(`set to ${a} in ${(performance.now() - s).toFixed(3)} ms`);
          } catch (g) {
            h(`ERROR @ ${a}: ${g && (g.message || String(g)) || "unknown"}`);
          }
        }), l;
      })() })), vt(d, f, null), vt(d, Nt(ce, { get each() {
        return O();
      }, children: (a) => Nt(Jn, { get author() {
        return a.author;
      }, get body() {
        return a.body;
      }, get num() {
        return a.num;
      } }) }), null), d;
    })();
  }
  qn(() => Nt(tr, {}), jn);
})();
})
