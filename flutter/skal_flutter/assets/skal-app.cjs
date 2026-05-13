// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var z = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Yt(this.context.count);
  }, getNextContextId() {
    return Yt(this.context.count++);
  } };
  function Yt(t) {
    const e = String(t), n = e.length - 1;
    return z.context.id + (n ? String.fromCharCode(96 + n) : "") + e;
  }
  function qt(t) {
    z.context = t;
  }
  function Te() {
    return { ...z.context, id: z.getNextContextId(), count: 0 };
  }
  var be = (t, e) => t === e, It = Symbol("solid-proxy"), Re = typeof Proxy == "function", ye = Symbol("solid-track"), gt = { equals: be }, Xt = null, Ae = ee, k = 1, it = 2, jt = { owned: null, cleanups: null, context: null, owner: null }, b = null, u = null, st = null, Q = null, R = null, C = null, x = null, vt = 0;
  function _t(t, e) {
    const n = R, r = b, i = t.length === 0, o = e === undefined ? r : e, f = i ? jt : { owned: null, cleanups: null, context: o ? o.context : null, owner: o }, h = i ? t : () => t(() => Z(() => Y(f)));
    b = f, R = null;
    try {
      return M(h, true);
    } finally {
      R = n, b = r;
    }
  }
  function H(t, e) {
    e = e ? Object.assign({}, gt, e) : gt;
    const n = { value: t, observers: null, observerSlots: null, comparator: e.equals || undefined }, r = (i) => (typeof i == "function" && (u && u.running && u.sources.has(n) ? i = i(n.tValue) : i = i(n.value)), Zt(n, i));
    return [Qt.bind(n), r];
  }
  function $(t, e, n) {
    const r = te(t, e, false, k);
    st && u && u.running ? C.push(r) : St(r);
  }
  function dt(t, e, n) {
    n = n ? Object.assign({}, gt, n) : gt;
    const r = te(t, e, true, 0);
    return r.observers = null, r.observerSlots = null, r.comparator = n.equals || undefined, st && u && u.running ? (r.tState = k, C.push(r)) : St(r), Qt.bind(r);
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
  function Kt(t) {
    return b === null || (b.cleanups === null ? b.cleanups = [t] : b.cleanups.push(t)), t;
  }
  function Ie(t) {
    if (u && u.running)
      return t(), u.done;
    const e = R, n = b;
    return Promise.resolve().then(() => {
      R = e, b = n;
      let r;
      return (st || me) && (r = u || (u = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), r.done || (r.done = new Promise((i) => r.resolve = i)), r.running = true), M(t, false), R = b = null, r ? r.done : undefined;
    });
  }
  var [Xn, zt] = H(false), me;
  function Qt() {
    const t = u && u.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === k)
        St(this);
      else {
        const e = C;
        C = null, M(() => Et(this), false), C = e;
      }
    if (R) {
      const e = this.observers ? this.observers.length : 0;
      R.sources ? (R.sources.push(this), R.sourceSlots.push(e)) : (R.sources = [this], R.sourceSlots = [e]), this.observers ? (this.observers.push(R), this.observerSlots.push(R.sources.length - 1)) : (this.observers = [R], this.observerSlots = [R.sources.length - 1]);
    }
    return t && u.sources.has(this) ? this.tValue : this.value;
  }
  function Zt(t, e, n) {
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
          f && u.disposed.has(o) || ((f ? !o.tState : !o.state) && (o.pure ? C.push(o) : x.push(o), o.observers && ne(o)), f ? o.tState = k : o.state = k);
        }
        if (C.length > 1e6)
          throw C = [], new Error;
      }, false);
    }
    return e;
  }
  function St(t) {
    if (!t.fn)
      return;
    Y(t);
    const e = vt;
    Jt(t, u && u.running && u.sources.has(t) ? t.tValue : t.value, e), u && !u.running && u.sources.has(t) && queueMicrotask(() => {
      M(() => {
        u && (u.running = true), R = b = t, Jt(t, t.tValue, e), R = b = null;
      }, false);
    });
  }
  function Jt(t, e, n) {
    let r;
    const i = b, o = R;
    R = b = t;
    try {
      r = t.fn(e);
    } catch (f) {
      return t.pure && (u && u.running ? (t.tState = k, t.tOwned && t.tOwned.forEach(Y), t.tOwned = undefined) : (t.state = k, t.owned && t.owned.forEach(Y), t.owned = null)), t.updatedAt = n + 1, Ct(f);
    } finally {
      R = o, b = i;
    }
    (!t.updatedAt || t.updatedAt <= n) && (t.updatedAt != null && ("observers" in t) ? Zt(t, r, true) : u && u.running && t.pure ? (u.sources.has(t) || (t.value = r), u.sources.add(t), t.tValue = r) : t.value = r, t.updatedAt = n);
  }
  function te(t, e, n, r = k, i) {
    const o = { fn: t, state: r, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: e, owner: b, context: b ? b.context : null, pure: n };
    if (u && u.running && (o.state = 0, o.tState = r), b === null || b !== jt && (u && u.running && b.pure ? b.tOwned ? b.tOwned.push(o) : b.tOwned = [o] : b.owned ? b.owned.push(o) : b.owned = [o]), Q && o.fn) {
      const f = o.fn, [h, E] = H(undefined, { equals: false }), v = Q.factory(f, E);
      Kt(() => v.dispose());
      let w;
      const c = () => Ie(E).then(() => {
        w && (w.dispose(), w = undefined);
      });
      o.fn = (I) => (h(), u && u.running ? (w || (w = Q.factory(f, c)), w.track(I)) : v.track(I));
    }
    return o;
  }
  function mt(t) {
    const e = u && u.running;
    if ((e ? t.tState : t.state) === 0)
      return;
    if ((e ? t.tState : t.state) === it)
      return Et(t);
    if (t.suspense && Z(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const n = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < vt); ) {
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
      if ((e ? t.tState : t.state) === k)
        St(t);
      else if ((e ? t.tState : t.state) === it) {
        const i = C;
        C = null, M(() => Et(t, n[0]), false), C = i;
      }
    }
  }
  function M(t, e) {
    if (C)
      return t();
    let n = false;
    e || (C = []), x ? n = true : x = [], vt++;
    try {
      const r = t();
      return Ce(n), r;
    } catch (r) {
      n || (x = null), C = null, Ct(r);
    }
  }
  function Ce(t) {
    if (C && (st && u && u.running ? Fe(C) : ee(C), C = null), t)
      return;
    let e;
    if (u) {
      if (!u.promises.size && !u.queue.size) {
        const { sources: r, disposed: i } = u;
        x.push.apply(x, u.effects), e = u.resolve;
        for (const o of x)
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
          zt(false);
        }, false);
      } else if (u.running) {
        u.running = false, u.effects.push.apply(u.effects, x), x = null, zt(true);
        return;
      }
    }
    const n = x;
    x = null, n.length && M(() => Ae(n), false), e && e();
  }
  function ee(t) {
    for (let e = 0;e < t.length; e++)
      mt(t[e]);
  }
  function Fe(t) {
    for (let e = 0;e < t.length; e++) {
      const n = t[e], r = u.queue;
      r.has(n) || (r.add(n), st(() => {
        r.delete(n), M(() => {
          u.running = true, mt(n);
        }, false), u && (u.running = false);
      }));
    }
  }
  function Et(t, e) {
    const n = u && u.running;
    n ? t.tState = 0 : t.state = 0;
    for (let r = 0;r < t.sources.length; r += 1) {
      const i = t.sources[r];
      if (i.sources) {
        const o = n ? i.tState : i.state;
        o === k ? i !== e && (!i.updatedAt || i.updatedAt < vt) && mt(i) : o === it && Et(i, e);
      }
    }
  }
  function ne(t) {
    const e = u && u.running;
    for (let n = 0;n < t.observers.length; n += 1) {
      const r = t.observers[n];
      (e ? !r.tState : !r.state) && (e ? r.tState = it : r.state = it, r.pure ? C.push(r) : x.push(r), r.observers && ne(r));
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
      re(t, true);
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
  function re(t, e) {
    if (e || (t.tState = 0, u.disposed.add(t)), t.owned)
      for (let n = 0;n < t.owned.length; n++)
        re(t.owned[n]);
  }
  function Ne(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function ie(t, e, n) {
    try {
      for (const r of e)
        r(t);
    } catch (r) {
      Ct(r, n && n.owner || null);
    }
  }
  function Ct(t, e = b) {
    const n = Xt && e && e.context && e.context[Xt], r = Ne(t);
    if (!n)
      throw r;
    x ? x.push({ fn() {
      ie(r, n, e);
    }, state: k }) : ie(r, n, e);
  }
  var xe = Symbol("fallback");
  function se(t) {
    for (let e = 0;e < t.length; e++)
      t[e]();
  }
  function Le(t, e, n = {}) {
    let r = [], i = [], o = [], f = 0, h = e.length > 1 ? [] : null;
    return Kt(() => se(o)), () => {
      let E = t() || [], v = E.length, w, c;
      return E[ye], Z(() => {
        let A, y, _, m, F, a, l, s, g;
        if (v === 0)
          f !== 0 && (se(o), o = [], r = [], i = [], f = 0, h && (h = [])), n.fallback && (r = [xe], i[0] = _t((O) => (o[0] = O, n.fallback())), f = 1);
        else if (f === 0) {
          for (i = new Array(v), c = 0;c < v; c++)
            r[c] = E[c], i[c] = _t(I);
          f = v;
        } else {
          for (_ = new Array(v), m = new Array(v), h && (F = new Array(v)), a = 0, l = Math.min(f, v);a < l && r[a] === E[a]; a++)
            ;
          for (l = f - 1, s = v - 1;l >= a && s >= a && r[l] === E[s]; l--, s--)
            _[s] = i[l], m[s] = o[l], h && (F[s] = h[l]);
          for (A = new Map, y = new Array(s + 1), c = s;c >= a; c--)
            g = E[c], w = A.get(g), y[c] = w === undefined ? -1 : w, A.set(g, c);
          for (w = a;w <= l; w++)
            g = r[w], c = A.get(g), c !== undefined && c !== -1 ? (_[c] = i[w], m[c] = o[w], h && (F[c] = h[w]), c = y[c], A.set(g, c)) : o[w]();
          for (c = a;c < v; c++)
            c in _ ? (i[c] = _[c], o[c] = m[c], h && (h[c] = F[c], h[c](c))) : i[c] = _t(I);
          i = i.slice(0, f = v), r = E.slice(0);
        }
        return i;
      });
      function I(A) {
        if (o[c] = A, h) {
          const [y, _] = H(c);
          return h[c] = _, e(E[c], y);
        }
        return e(E[c]);
      }
    };
  }
  var De = false;
  function ke(t, e) {
    if (De && z.context) {
      const n = z.context;
      qt(Te());
      const r = Z(() => t(e || {}));
      return qt(n), r;
    }
    return Z(() => t(e || {}));
  }
  function Ot() {
    return true;
  }
  var He = { get(t, e, n) {
    return e === It ? n : t.get(e);
  }, has(t, e) {
    return e === It ? true : t.has(e);
  }, set: Ot, deleteProperty: Ot, getOwnPropertyDescriptor(t, e) {
    return { configurable: true, enumerable: true, get() {
      return t.get(e);
    }, set: Ot, deleteProperty: Ot };
  }, ownKeys(t) {
    return t.keys();
  } };
  function Ft(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function Be() {
    for (let t = 0, e = this.length;t < e; ++t) {
      const n = this[t]();
      if (n !== undefined)
        return n;
    }
  }
  function oe(...t) {
    let e = false;
    for (let f = 0;f < t.length; f++) {
      const h = t[f];
      e = e || !!h && It in h, t[f] = typeof h == "function" ? (e = true, dt(h)) : h;
    }
    if (Re && e)
      return new Proxy({ get(f) {
        for (let h = t.length - 1;h >= 0; h--) {
          const E = Ft(t[h])[f];
          if (E !== undefined)
            return E;
        }
      }, has(f) {
        for (let h = t.length - 1;h >= 0; h--)
          if (f in Ft(t[h]))
            return true;
        return false;
      }, keys() {
        const f = [];
        for (let h = 0;h < t.length; h++)
          f.push(...Object.keys(Ft(t[h])));
        return [...new Set(f)];
      } }, He);
    const n = {}, r = Object.create(null);
    for (let f = t.length - 1;f >= 0; f--) {
      const h = t[f];
      if (!h)
        continue;
      const E = Object.getOwnPropertyNames(h);
      for (let v = E.length - 1;v >= 0; v--) {
        const w = E[v];
        if (w === "__proto__" || w === "constructor")
          continue;
        const c = Object.getOwnPropertyDescriptor(h, w);
        if (!r[w])
          r[w] = c.get ? { enumerable: true, configurable: true, get: Be.bind(n[w] = [c.get.bind(h)]) } : c.value !== undefined ? c : undefined;
        else {
          const I = n[w];
          I && (c.get ? I.push(c.get.bind(h)) : c.value !== undefined && I.push(() => c.value));
        }
      }
    }
    const i = {}, o = Object.keys(r);
    for (let f = o.length - 1;f >= 0; f--) {
      const h = o[f], E = r[h];
      E && E.get ? Object.defineProperty(i, h, E) : i[h] = E ? E.value : undefined;
    }
    return i;
  }
  function le(t) {
    const e = "fallback" in t && { fallback: () => t.fallback };
    return dt(Le(() => t.each, t.children, e || undefined));
  }
  var Ge = (t) => dt(() => t());
  function We({ createElement: t, createTextNode: e, isTextNode: n, replaceText: r, insertNode: i, removeNode: o, setProperty: f, getParentNode: h, getFirstChild: E, getNextSibling: v }) {
    function w(a, l, s, g) {
      if (s !== undefined && !g && (g = []), typeof l != "function")
        return c(a, l, g, s);
      $((O) => c(a, l(), O, s), g);
    }
    function c(a, l, s, g, O) {
      for (;typeof s == "function"; )
        s = s();
      if (l === s)
        return s;
      const P = typeof l, p = g !== undefined;
      if (P === "string" || P === "number")
        if (P === "number" && (l = l.toString()), p) {
          let d = s[0];
          d && n(d) ? r(d, l) : d = e(l), s = y(a, s, g, d);
        } else
          s !== "" && typeof s == "string" ? r(E(a), s = l) : (y(a, s, g, e(l)), s = l);
      else if (l == null || P === "boolean")
        s = y(a, s, g);
      else {
        if (P === "function")
          return $(() => {
            let d = l();
            for (;typeof d == "function"; )
              d = d();
            s = c(a, d, s, g);
          }), () => s;
        if (Array.isArray(l)) {
          const d = [];
          if (I(d, l, O))
            return $(() => s = c(a, d, s, g, true)), () => s;
          if (d.length === 0) {
            const rt = y(a, s, g);
            if (p)
              return s = rt;
          } else
            Array.isArray(s) ? s.length === 0 ? _(a, d, g) : A(a, s, d) : s == null || s === "" ? _(a, d) : A(a, p && s || [E(a)], d);
          s = d;
        } else {
          if (Array.isArray(s)) {
            if (p)
              return s = y(a, s, g, l);
            y(a, s, null, l);
          } else
            s == null || s === "" || !E(a) ? i(a, l) : m(a, l, E(a));
          s = l;
        }
      }
      return s;
    }
    function I(a, l, s) {
      let g = false;
      for (let O = 0, P = l.length;O < P; O++) {
        let p = l[O], d;
        if (!(p == null || p === true || p === false))
          if (Array.isArray(p))
            g = I(a, p) || g;
          else if ((d = typeof p) == "string" || d === "number")
            a.push(e(p));
          else if (d === "function")
            if (s) {
              for (;typeof p == "function"; )
                p = p();
              g = I(a, Array.isArray(p) ? p : [p]) || g;
            } else
              a.push(p), g = true;
          else
            a.push(p);
      }
      return g;
    }
    function A(a, l, s) {
      let g = s.length, O = l.length, P = g, p = 0, d = 0, rt = v(l[O - 1]), j = null;
      for (;p < O || d < P; ) {
        if (l[p] === s[d]) {
          p++, d++;
          continue;
        }
        for (;l[O - 1] === s[P - 1]; )
          O--, P--;
        if (O === p) {
          const V = P < g ? d ? v(s[d - 1]) : s[P - d] : rt;
          for (;d < P; )
            i(a, s[d++], V);
        } else if (P === d)
          for (;p < O; )
            (!j || !j.has(l[p])) && o(a, l[p]), p++;
        else if (l[p] === s[P - 1] && s[d] === l[O - 1]) {
          const V = v(l[--O]);
          i(a, s[d++], v(l[p++])), i(a, s[--P], V), l[O] = s[P];
        } else {
          if (!j) {
            j = new Map;
            let K = d;
            for (;K < P; )
              j.set(s[K], K++);
          }
          const V = j.get(l[p]);
          if (V != null)
            if (d < V && V < P) {
              let K = p, $t = 1, Pe;
              for (;++K < O && K < P && !((Pe = j.get(l[K])) == null || Pe !== V + $t); )
                $t++;
              if ($t > V - d) {
                const qn = l[p];
                for (;d < V; )
                  i(a, s[d++], qn);
              } else
                m(a, s[d++], l[p++]);
            } else
              p++;
          else
            o(a, l[p++]);
        }
      }
    }
    function y(a, l, s, g) {
      if (s === undefined) {
        let P;
        for (;P = E(a); )
          o(a, P);
        return g && i(a, g), "";
      }
      const O = g || e("");
      if (l.length) {
        let P = false;
        for (let p = l.length - 1;p >= 0; p--) {
          const d = l[p];
          if (O !== d) {
            const rt = h(d) === a;
            !P && !p ? rt ? m(a, O, d) : i(a, O, s) : rt && o(a, d);
          } else
            P = true;
        }
      } else
        i(a, O, s);
      return [O];
    }
    function _(a, l, s) {
      for (let g = 0, O = l.length;g < O; g++)
        i(a, l[g], s);
    }
    function m(a, l, s) {
      i(a, l, s), o(a, s);
    }
    function F(a, l, s = {}, g) {
      return l || (l = {}), g || $(() => s.children = c(a, l.children, s.children)), $(() => l.ref && l.ref(a)), $(() => {
        for (const O in l) {
          if (O === "children" || O === "ref")
            continue;
          const P = l[O];
          P !== s[O] && (f(a, O, P, s[O]), s[O] = P);
        }
      }), s;
    }
    return { render(a, l) {
      let s;
      return _t((g) => {
        s = g, w(l, a());
      }), s;
    }, insert: w, spread(a, l, s) {
      typeof l == "function" ? $((g) => F(a, l(), g, s)) : F(a, l, undefined, s);
    }, createElement: t, createTextNode: e, insertNode: i, setProp(a, l, s, g) {
      return f(a, l, s, g), s;
    }, mergeProps: oe, effect: $, memo: Ge, createComponent: ke, use(a, l, s) {
      return Z(() => a(l, s));
    } };
  }
  function Ue(t) {
    const e = We(t);
    return e.mergeProps = oe, e;
  }
  var ae = 6 * 1024 * 1024, Ve = 64, jn = Ve, ue = 4 * 1024 * 1024, J = 64 + ue, fe = 1024 * 1024, Nt = J + fe, Me = J + fe, $e = 0, Ye = 8, qe = 12, Xe = 16, je = 24, Ke = 28, ze = 32, Qe = Ye >> 2, Ze = qe >> 2, Je = je >> 2, ce = Ke >> 2, tn = $e >> 3, en = Xe >> 3, nn = ze >> 3, Kn = 1, zn = 2, Qn = 3, Zn = 16, Jn = 17, tr = 20, er = 21, nr = 22, rr = 32, ir = 33, sr = 34, or = 35, lr = 36, ar = 37, ur = 0, fr = 1, cr = 2, hr = 3, gr = 4, vr = 5, _r = 6, dr = 1, Sr = 0, Er = 1, Or = 2, pr = 3, wr = 4, Pr = 5, Tr = 6, br = 7, Rr = 8, yr = 9, Ar = 32, Ir = 33, mr = 34, Cr = 35, Fr = 36, Nr = 37, xr = 64, Lr = 65, Dr = 66, kr = 67, Hr = 68, Br = 69, Gr = 70, Wr = 96, Ur = 97, Vr = 128, Mr = 129, $r = 130, Yr = 131, qr = 160, Xr = 161, jr = 162, Kr = -1, rn = 2147483646, sn = 2147483645, X = globalThis.__skal_acquireBridge();
  if (!X || X.byteLength !== ae)
    throw new Error(`Skal: bridge buffer not available (got ${X && X.byteLength})`);
  var on = new Uint8Array(X), W = new Uint32Array(X), xt = new BigInt64Array(X), ln = new TextEncoder, ot = 16, an = 64 + ue >> 2, un = 16384, fn = an - 4, pt = 0n, q = ot, lt = J, wt = ot;
  function Lt() {
    W[Qe] = q - ot << 2, W[Ze] = lt - J, pt += 1n, Atomics.store(xt, tn, pt), wt = q;
  }
  function cn() {
    Lt();
    const t = pt, e = performance.now() + 5000;
    for (;!(Atomics.load(xt, nn) >= t); )
      if (performance.now() > e) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    q = ot, lt = J, wt = ot;
  }
  function B(t, e, n, r) {
    let i = q;
    i >= fn && (cn(), i = q), W[i] = t >>> 0, W[i + 1] = e >>> 0, W[i + 2] = n >>> 0, W[i + 3] = r >>> 0, q = i + 4, q - wt >= un && Lt();
  }
  var Dt = 0, kt = 0;
  function he(t) {
    const e = lt - J, n = on.subarray(lt, Me), { read: r, written: i } = ln.encodeInto(t, n);
    if (r !== t.length)
      throw new Error(`Skal: string heap full (need ${t.length} code units, fit ${r})`);
    lt += i, Dt = e, kt = i;
  }
  function Ht(t, e) {
    he(e), B(20, t, Dt, kt);
  }
  var Bt = false;
  function hn() {
    Bt = false, q !== wt && Lt();
  }
  function N() {
    Bt || (Bt = true, queueMicrotask(hn));
  }
  var U = 1024, T = new Int8Array(256);
  T.fill(-1), T[0] = 0, T[1] = 1, T[2] = 2, T[3] = 3, T[4] = 4, T[5] = 5, T[6] = 6, T[7] = 7, T[8] = 8, T[9] = 9, T[32] = 10, T[33] = 11, T[34] = 12, T[35] = 13, T[36] = 14, T[37] = 15, T[64] = 16, T[65] = 17, T[66] = 18, T[67] = 19, T[68] = 20, T[69] = 21, T[70] = 22, T[96] = 23, T[97] = 24, T[128] = 25, T[129] = 26, T[130] = 27, T[131] = 28, T[160] = 29, T[161] = 30, T[162] = 31;
  var D = 32, Pt = new Int32Array(U * D), at = new Float32Array(U * D), Tt = new Array(U * D), ut = new Uint8Array(U * D), tt = 6, et = new Float32Array(U * tt);
  et.fill(NaN);
  var bt = new Map, ge = [], gn = 0;
  function vn() {
    const t = U * 2, e = U * D, n = t * D, r = U * tt, i = t * tt, o = new Int32Array(n);
    o.set(Pt), Pt = o;
    const f = new Uint8Array(n);
    f.set(ut), ut = f;
    const h = new Float32Array(n);
    h.set(at), h.fill(NaN, e), at = h;
    const E = new Float32Array(i);
    E.set(et), E.fill(NaN, r), et = E, Tt.length = n, U = t;
  }
  function Rt(t) {
    let e = bt.get(t);
    if (e === undefined) {
      e = ge.pop(), e === undefined && (e = gn++), e >= U && vn(), bt.set(t, e);
      const n = e * D;
      ut.fill(0, n, n + D), at.fill(NaN, n, n + D);
      for (let r = n;r < n + D; r++)
        Tt[r] = undefined;
    }
    return e;
  }
  function _n(t) {
    const e = bt.get(t);
    if (e !== undefined) {
      bt.delete(t), ge.push(e);
      const n = e * tt;
      et.fill(NaN, n, n + tt);
    }
  }
  var ft = 0, ct = 0, Gt = new Float32Array(1), ve = new Uint32Array(Gt.buffer);
  function yt(t, e, n) {
    const r = T[e];
    if (r < 0)
      return;
    const i = Rt(t) * D + r, o = n | 0;
    if (ut[i] !== 0 && Pt[i] === o) {
      ct++;
      return;
    }
    Pt[i] = o, ut[i] = 1, B(16, t, e, o), ft++;
  }
  function dn(t, e, n) {
    const r = T[e];
    if (r < 0)
      return;
    const i = Rt(t) * D + r;
    if (at[i] === n) {
      ct++;
      return;
    }
    at[i] = n, Gt[0] = n, B(17, t, e, ve[0]), ft++;
  }
  function Sn(t, e, n) {
    const r = T[e];
    if (r < 0)
      return;
    const i = Rt(t) * D + r;
    if (Tt[i] === n) {
      ct++;
      return;
    }
    Tt[i] = n, he(n == null ? "" : String(n)), B(22, t, (e & 255) << 24 | Dt & 16777215, kt), ft++;
  }
  function nt(t, e, n, r) {
    const i = Rt(t) * tt + n;
    if (et[i] === r) {
      ct++;
      return;
    }
    et[i] = r, Gt[0] = r, B(e, t, 0, ve[0]), ft++;
  }
  function En(t, e) {
    nt(t, 32, 0, e);
  }
  function On(t, e) {
    nt(t, 33, 1, e);
  }
  function pn(t, e) {
    nt(t, 34, 2, e);
  }
  function wn(t, e) {
    nt(t, 35, 3, e);
  }
  function Pn(t, e) {
    nt(t, 36, 4, e);
  }
  function Tn(t, e) {
    nt(t, 37, 5, e);
  }
  var Wt = new Map, bn = 1;
  function Rn(t) {
    const e = bn++;
    return Wt.set(e, t), e;
  }
  function yn(t, e, n) {
    B(21, t, e, n);
  }
  var Ut = 0n, _e = null, de = ae - Nt, Vt = Nt >> 2, An = Nt + de >> 2, In = de / 16 | 0;
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load(xt, en);
    if (t === Ut)
      return;
    const e = Vt + (W[Je] >> 2);
    let n = Vt + (W[ce] >> 2);
    const r = An, i = Vt;
    let o = In;
    for (;n !== e && o-- > 0; ) {
      const f = W[n + 1], h = Wt.get(f);
      if (h)
        try {
          h();
        } catch (E) {
          _e = E && (E.stack || E.message || String(E)) || "unknown";
        }
      n += 4, n >= r && (n = i);
    }
    W[ce] = n - i << 2, Ut = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: Wt.size, opSeq: Number(pt), lastEventSeq: Number(Ut), lastHandlerError: _e, propWrites: ft, propSkips: ct });
  var zr = 1, mn = 2;
  function Se() {
    return mn++;
  }
  var Cn = { box: 0, column: 1, scrollColumn: 5, lazyColumn: 6, row: 2, text: 3, button: 4 }, Fn = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"] }, Nn = { opacity: En, translationX: On, translationY: pn, scaleX: wn, scaleY: Pn, rotation: Tn };
  function xn(t) {
    if (typeof t == "number")
      return t | 0;
    if (typeof t != "string")
      return 0;
    let e = t.trim();
    e.startsWith("#") && (e = e.slice(1));
    let n = 0, r = 0, i = 0, o = 255;
    return e.length === 3 ? (n = parseInt(e[0] + e[0], 16), r = parseInt(e[1] + e[1], 16), i = parseInt(e[2] + e[2], 16)) : e.length === 4 ? (n = parseInt(e[0] + e[0], 16), r = parseInt(e[1] + e[1], 16), i = parseInt(e[2] + e[2], 16), o = parseInt(e[3] + e[3], 16)) : e.length === 6 ? (n = parseInt(e.slice(0, 2), 16), r = parseInt(e.slice(2, 4), 16), i = parseInt(e.slice(4, 6), 16)) : e.length === 8 && (o = parseInt(e.slice(0, 2), 16), n = parseInt(e.slice(2, 4), 16), r = parseInt(e.slice(4, 6), 16), i = parseInt(e.slice(6, 8), 16)), (o & 255) << 24 | (n & 255) << 16 | (r & 255) << 8 | i & 255 | 0;
  }
  function Ln(t) {
    return typeof t == "number" ? t | 0 : t === "fill" ? rn : t === "wrap" ? sn : -1;
  }
  function Dn(t) {
    const e = [t];
    for (;e.length > 0; ) {
      const n = e.pop();
      _n(n.id);
      let r = n.firstChild;
      for (;r; )
        e.push(r), r = r.nextSibling;
    }
  }
  var Mt = class {
    constructor(t, e, n = false) {
      this.tag = t, this.id = e, this.isText = n, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, kn = Ue({ createElement(t) {
    const e = Cn[t];
    if (e === undefined)
      throw new Error(`Skal: unknown JSX tag <${t}>`);
    const n = Se();
    return B(1, n, e, 0), N(), new Mt(t, n, false);
  }, createTextNode(t) {
    const e = Se();
    B(1, e, 3, 0);
    const n = t == null ? "" : String(t);
    n.length > 0 && Ht(e, n), N();
    const r = new Mt("#text", e, true);
    return r.text = n, r;
  }, replaceText(t, e) {
    const n = e == null ? "" : String(e);
    t.text !== n && (t.text = n, Ht(t.id, n), N());
  }, setProperty(t, e, n, r) {
    if (e === "onClick" || e === "onclick") {
      if (typeof n == "function") {
        const f = Rn(n);
        yn(t.id, 1, f), N();
      }
      return;
    }
    if (e === "label" && (t.tag === "button" || t.tag === "text")) {
      const f = n == null ? "" : String(n);
      Ht(t.id, f), N();
      return;
    }
    const i = Nn[e];
    if (i !== undefined) {
      typeof n == "number" && (i(t.id, n), N());
      return;
    }
    const o = Fn[e];
    if (o !== undefined) {
      const [f, h] = o;
      if (n == null)
        return;
      switch (h) {
        case "u32":
          typeof n == "number" ? (yt(t.id, f, n | 0), N()) : typeof n == "boolean" && (yt(t.id, f, n ? 1 : 0), N());
          return;
        case "f32":
          typeof n == "number" && (dn(t.id, f, n), N());
          return;
        case "str":
          Sn(t.id, f, String(n)), N();
          return;
        case "color":
          yt(t.id, f, xn(n)), N();
          return;
        case "dim":
          yt(t.id, f, Ln(n)), N();
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
    B(3, t.id, e.id, r), N(), e.parent = t, n ? (e.nextSibling = n, e.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = e : t.firstChild = e, n.prevSibling = e) : (e.prevSibling = t.lastChild, e.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = e : t.firstChild = e, t.lastChild = e);
  }, removeNode(t, e) {
    B(2, e.id, 0, 0), Dn(e), N(), e.prevSibling ? e.prevSibling.nextSibling = e.nextSibling : t.firstChild = e.nextSibling, e.nextSibling ? e.nextSibling.prevSibling = e.prevSibling : t.lastChild = e.prevSibling, e.parent = null, e.prevSibling = null, e.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: Hn, effect: Bn, memo: Qr, createComponent: At, createElement: L, createTextNode: Zr, insertNode: G, insert: ht, spread: Jr, setProp: S, mergeProps: ti, use: ei } = kn;
  B(1, 1, 0, 0), N();
  var Gn = new Mt("box", 1, false), Ee = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], Wn = Array.from({ length: 5000 }, (t, e) => ({ author: `@user${e * 2654435761 >>> 17}`, body: Ee[e % Ee.length], num: e + 1 })), Un = [50, 200, 500, 1000, 2000, 5000], Oe = "#FFF1F5F9", pe = "#FF475569", Vn = "#FF22C55E", Mn = "#FFEF4444", we = "#FFFFFFFF";
  function $n(t) {
    const [e, n] = H(0), [r, i] = H(false), [o, f] = H(0), [h, E] = H(false);
    return (() => {
      var v = L("column"), w = L("text"), c = L("text"), I = L("row"), A = L("button"), y = L("button");
      return G(v, w), G(v, c), G(v, I), S(v, "background", "#FFFFFFFF"), S(v, "padding", 12), S(v, "cornerRadius", 10), S(v, "borderWidth", 1), S(v, "borderColor", "#FFE5E5EA"), S(v, "gap", 6), S(w, "fontWeight", 700), S(w, "fontSize", 14), S(w, "color", "#FF1DA1F2"), S(c, "fontSize", 14), S(c, "color", "#FF1F2937"), S(c, "maxLines", 3), S(c, "textOverflow", 1), G(I, A), G(I, y), S(I, "gap", 10), S(A, "fontSize", 12), S(A, "padding", 6), S(A, "cornerRadius", 16), S(A, "onClick", () => {
        const _ = !r();
        i(_), n(e() + (_ ? 1 : -1));
      }), S(y, "fontSize", 12), S(y, "padding", 6), S(y, "cornerRadius", 16), S(y, "onClick", () => {
        const _ = !h();
        E(_), f(o() + (_ ? 1 : -1));
      }), Bn((_) => {
        var m = `#${t.num} \xB7 ${t.author}`, F = t.body, a = `\u2665 ${e()}`, l = r() ? Vn : Oe, s = r() ? we : pe, g = `\u21A9 ${o()}`, O = h() ? Mn : Oe, P = h() ? we : pe;
        return m !== _.e && (_.e = S(w, "label", m, _.e)), F !== _.t && (_.t = S(c, "label", F, _.t)), a !== _.a && (_.a = S(A, "label", a, _.a)), l !== _.o && (_.o = S(A, "background", l, _.o)), s !== _.i && (_.i = S(A, "color", s, _.i)), g !== _.n && (_.n = S(y, "label", g, _.n)), O !== _.s && (_.s = S(y, "background", O, _.s)), P !== _.h && (_.h = S(y, "color", P, _.h)), _;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), v;
    })();
  }
  function Yn() {
    const [t, e] = H(0), [n, r] = H("tap +1000 to benchmark fast-path"), [i, o] = H(50), [f, h] = H(""), E = dt(() => Wn.slice(0, i()));
    return (() => {
      var v = L("lazyColumn"), w = L("box"), c = L("row"), I = L("button"), A = L("button"), y = L("button"), _ = L("row");
      return G(v, w), G(v, c), G(v, y), G(v, _), S(v, "background", "#FFFAFAFA"), S(v, "padding", 16), S(v, "gap", 12), S(w, "background", "#FF1DA1F2"), S(w, "padding", 12), S(w, "cornerRadius", 8), ht(w, () => `Count: ${t()}`), G(c, I), G(c, A), S(c, "gap", 8), S(I, "label", "Increment"), S(I, "onClick", () => e(t() + 1)), S(A, "label", "Decrement"), S(A, "onClick", () => e(t() - 1)), S(y, "label", "+1000 (benchmark)"), S(y, "onClick", () => {
        const m = t(), F = performance.now();
        let a = 0, l = -1, s = "";
        try {
          for (;a < 1000; a++)
            e(t() + 1);
        } catch (P) {
          l = a, s = P && (P.message || String(P)) || "unknown";
        }
        const g = (performance.now() - F).toFixed(3), O = t() - m;
        l >= 0 ? r(`crashed @${l}: ${s} \xB7 delta=${O}`) : r(`+1000 ${g}ms \xB7 iter=${a} delta=${O}`);
      }), ht(v, n, _), ht(_, At(le, { each: Un, children: (m) => (() => {
        var F = L("button");
        return S(F, "label", `${m}`), S(F, "onClick", () => {
          const a = performance.now();
          try {
            o(m), h(`set to ${m} in ${(performance.now() - a).toFixed(3)} ms`);
          } catch (l) {
            h(`ERROR @ ${m}: ${l && (l.message || String(l)) || "unknown"}`);
          }
        }), F;
      })() })), ht(v, f, null), ht(v, At(le, { get each() {
        return E();
      }, children: (m) => At($n, { get author() {
        return m.author;
      }, get body() {
        return m.body;
      }, get num() {
        return m.num;
      } }) }), null), v;
    })();
  }
  Hn(() => At(Yn, {}), Gn);
})();
})
