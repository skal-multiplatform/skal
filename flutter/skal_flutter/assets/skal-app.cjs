// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var Q = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Kt(this.context.count);
  }, getNextContextId() {
    return Kt(this.context.count++);
  } };
  function Kt(t) {
    const e = String(t), n = e.length - 1;
    return Q.context.id + (n ? String.fromCharCode(96 + n) : "") + e;
  }
  function Qt(t) {
    Q.context = t;
  }
  function Ce() {
    return { ...Q.context, id: Q.getNextContextId(), count: 0 };
  }
  var Fe = (t, e) => t === e, kt = Symbol("solid-proxy"), Ne = typeof Proxy == "function", xe = Symbol("solid-track"), Et = { equals: Fe }, Zt = null, Le = oe, G = 1, lt = 2, Jt = { owned: null, cleanups: null, context: null, owner: null }, R = null, u = null, at = null, Z = null, y = null, F = null, H = null, Ot = 0;
  function pt(t, e) {
    const n = y, r = R, i = t.length === 0, o = e === undefined ? r : e, f = i ? Jt : { owned: null, cleanups: null, context: o ? o.context : null, owner: o }, g = i ? t : () => t(() => J(() => z(f)));
    R = f, y = null;
    try {
      return Y(g, true);
    } finally {
      y = n, R = r;
    }
  }
  function U(t, e) {
    e = e ? Object.assign({}, Et, e) : Et;
    const n = { value: t, observers: null, observerSlots: null, comparator: e.equals || undefined }, r = (i) => (typeof i == "function" && (u && u.running && u.sources.has(n) ? i = i(n.tValue) : i = i(n.value)), re(n, i));
    return [ne.bind(n), r];
  }
  function X(t, e, n) {
    const r = se(t, e, false, G);
    at && u && u.running ? F.push(r) : Pt(r);
  }
  function wt(t, e, n) {
    n = n ? Object.assign({}, Et, n) : Et;
    const r = se(t, e, true, 0);
    return r.observers = null, r.observerSlots = null, r.comparator = n.equals || undefined, at && u && u.running ? (r.tState = G, F.push(r)) : Pt(r), ne.bind(r);
  }
  function J(t) {
    if (!Z && y === null)
      return t();
    const e = y;
    y = null;
    try {
      return Z ? Z.untrack(t) : t();
    } finally {
      y = e;
    }
  }
  function te(t) {
    return R === null || (R.cleanups === null ? R.cleanups = [t] : R.cleanups.push(t)), t;
  }
  function De(t) {
    if (u && u.running)
      return t(), u.done;
    const e = y, n = R;
    return Promise.resolve().then(() => {
      y = e, R = n;
      let r;
      return (at || ke) && (r = u || (u = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), r.done || (r.done = new Promise((i) => r.resolve = i)), r.running = true), Y(t, false), y = R = null, r ? r.done : undefined;
    });
  }
  var [nr, ee] = U(false), ke;
  function ne() {
    const t = u && u.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === G)
        Pt(this);
      else {
        const e = F;
        F = null, Y(() => Tt(this), false), F = e;
      }
    if (y) {
      const e = this.observers ? this.observers.length : 0;
      y.sources ? (y.sources.push(this), y.sourceSlots.push(e)) : (y.sources = [this], y.sourceSlots = [e]), this.observers ? (this.observers.push(y), this.observerSlots.push(y.sources.length - 1)) : (this.observers = [y], this.observerSlots = [y.sources.length - 1]);
    }
    return t && u.sources.has(this) ? this.tValue : this.value;
  }
  function re(t, e, n) {
    let r = u && u.running && u.sources.has(t) ? t.tValue : t.value;
    if (!t.comparator || !t.comparator(r, e)) {
      if (u) {
        const i = u.running;
        (i || !n && u.sources.has(t)) && (u.sources.add(t), t.tValue = e), i || (t.value = e);
      } else
        t.value = e;
      t.observers && t.observers.length && Y(() => {
        for (let i = 0;i < t.observers.length; i += 1) {
          const o = t.observers[i], f = u && u.running;
          f && u.disposed.has(o) || ((f ? !o.tState : !o.state) && (o.pure ? F.push(o) : H.push(o), o.observers && le(o)), f ? o.tState = G : o.state = G);
        }
        if (F.length > 1e6)
          throw F = [], new Error;
      }, false);
    }
    return e;
  }
  function Pt(t) {
    if (!t.fn)
      return;
    z(t);
    const e = Ot;
    ie(t, u && u.running && u.sources.has(t) ? t.tValue : t.value, e), u && !u.running && u.sources.has(t) && queueMicrotask(() => {
      Y(() => {
        u && (u.running = true), y = R = t, ie(t, t.tValue, e), y = R = null;
      }, false);
    });
  }
  function ie(t, e, n) {
    let r;
    const i = R, o = y;
    y = R = t;
    try {
      r = t.fn(e);
    } catch (f) {
      return t.pure && (u && u.running ? (t.tState = G, t.tOwned && t.tOwned.forEach(z), t.tOwned = undefined) : (t.state = G, t.owned && t.owned.forEach(z), t.owned = null)), t.updatedAt = n + 1, Bt(f);
    } finally {
      y = o, R = i;
    }
    (!t.updatedAt || t.updatedAt <= n) && (t.updatedAt != null && ("observers" in t) ? re(t, r, true) : u && u.running && t.pure ? (u.sources.has(t) || (t.value = r), u.sources.add(t), t.tValue = r) : t.value = r, t.updatedAt = n);
  }
  function se(t, e, n, r = G, i) {
    const o = { fn: t, state: r, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: e, owner: R, context: R ? R.context : null, pure: n };
    if (u && u.running && (o.state = 0, o.tState = r), R === null || R !== Jt && (u && u.running && R.pure ? R.tOwned ? R.tOwned.push(o) : R.tOwned = [o] : R.owned ? R.owned.push(o) : R.owned = [o]), Z && o.fn) {
      const f = o.fn, [g, O] = U(undefined, { equals: false }), S = Z.factory(f, O);
      te(() => S.dispose());
      let w;
      const c = () => De(O).then(() => {
        w && (w.dispose(), w = undefined);
      });
      o.fn = (A) => (g(), u && u.running ? (w || (w = Z.factory(f, c)), w.track(A)) : S.track(A));
    }
    return o;
  }
  function Ht(t) {
    const e = u && u.running;
    if ((e ? t.tState : t.state) === 0)
      return;
    if ((e ? t.tState : t.state) === lt)
      return Tt(t);
    if (t.suspense && J(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const n = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < Ot); ) {
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
      if ((e ? t.tState : t.state) === G)
        Pt(t);
      else if ((e ? t.tState : t.state) === lt) {
        const i = F;
        F = null, Y(() => Tt(t, n[0]), false), F = i;
      }
    }
  }
  function Y(t, e) {
    if (F)
      return t();
    let n = false;
    e || (F = []), H ? n = true : H = [], Ot++;
    try {
      const r = t();
      return He(n), r;
    } catch (r) {
      n || (H = null), F = null, Bt(r);
    }
  }
  function He(t) {
    if (F && (at && u && u.running ? Be(F) : oe(F), F = null), t)
      return;
    let e;
    if (u) {
      if (!u.promises.size && !u.queue.size) {
        const { sources: r, disposed: i } = u;
        H.push.apply(H, u.effects), e = u.resolve;
        for (const o of H)
          "tState" in o && (o.state = o.tState), delete o.tState;
        u = null, Y(() => {
          for (const o of i)
            z(o);
          for (const o of r) {
            if (o.value = o.tValue, o.owned)
              for (let f = 0, g = o.owned.length;f < g; f++)
                z(o.owned[f]);
            o.tOwned && (o.owned = o.tOwned), delete o.tValue, delete o.tOwned, o.tState = 0;
          }
          ee(false);
        }, false);
      } else if (u.running) {
        u.running = false, u.effects.push.apply(u.effects, H), H = null, ee(true);
        return;
      }
    }
    const n = H;
    H = null, n.length && Y(() => Le(n), false), e && e();
  }
  function oe(t) {
    for (let e = 0;e < t.length; e++)
      Ht(t[e]);
  }
  function Be(t) {
    for (let e = 0;e < t.length; e++) {
      const n = t[e], r = u.queue;
      r.has(n) || (r.add(n), at(() => {
        r.delete(n), Y(() => {
          u.running = true, Ht(n);
        }, false), u && (u.running = false);
      }));
    }
  }
  function Tt(t, e) {
    const n = u && u.running;
    n ? t.tState = 0 : t.state = 0;
    for (let r = 0;r < t.sources.length; r += 1) {
      const i = t.sources[r];
      if (i.sources) {
        const o = n ? i.tState : i.state;
        o === G ? i !== e && (!i.updatedAt || i.updatedAt < Ot) && Ht(i) : o === lt && Tt(i, e);
      }
    }
  }
  function le(t) {
    const e = u && u.running;
    for (let n = 0;n < t.observers.length; n += 1) {
      const r = t.observers[n];
      (e ? !r.tState : !r.state) && (e ? r.tState = lt : r.state = lt, r.pure ? F.push(r) : H.push(r), r.observers && le(r));
    }
  }
  function z(t) {
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
        z(t.tOwned[e]);
      delete t.tOwned;
    }
    if (u && u.running && t.pure)
      ae(t, true);
    else if (t.owned) {
      for (e = t.owned.length - 1;e >= 0; e--)
        z(t.owned[e]);
      t.owned = null;
    }
    if (t.cleanups) {
      for (e = t.cleanups.length - 1;e >= 0; e--)
        t.cleanups[e]();
      t.cleanups = null;
    }
    u && u.running ? t.tState = 0 : t.state = 0;
  }
  function ae(t, e) {
    if (e || (t.tState = 0, u.disposed.add(t)), t.owned)
      for (let n = 0;n < t.owned.length; n++)
        ae(t.owned[n]);
  }
  function We(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function ue(t, e, n) {
    try {
      for (const r of e)
        r(t);
    } catch (r) {
      Bt(r, n && n.owner || null);
    }
  }
  function Bt(t, e = R) {
    const n = Zt && e && e.context && e.context[Zt], r = We(t);
    if (!n)
      throw r;
    H ? H.push({ fn() {
      ue(r, n, e);
    }, state: G }) : ue(r, n, e);
  }
  var Ve = Symbol("fallback");
  function fe(t) {
    for (let e = 0;e < t.length; e++)
      t[e]();
  }
  function Ge(t, e, n = {}) {
    let r = [], i = [], o = [], f = 0, g = e.length > 1 ? [] : null;
    return te(() => fe(o)), () => {
      let O = t() || [], S = O.length, w, c;
      return O[xe], J(() => {
        let m, b, E, L, D, a, l, s, _;
        if (S === 0)
          f !== 0 && (fe(o), o = [], r = [], i = [], f = 0, g && (g = [])), n.fallback && (r = [Ve], i[0] = pt((p) => (o[0] = p, n.fallback())), f = 1);
        else if (f === 0) {
          for (i = new Array(S), c = 0;c < S; c++)
            r[c] = O[c], i[c] = pt(A);
          f = S;
        } else {
          for (E = new Array(S), L = new Array(S), g && (D = new Array(S)), a = 0, l = Math.min(f, S);a < l && r[a] === O[a]; a++)
            ;
          for (l = f - 1, s = S - 1;l >= a && s >= a && r[l] === O[s]; l--, s--)
            E[s] = i[l], L[s] = o[l], g && (D[s] = g[l]);
          for (m = new Map, b = new Array(s + 1), c = s;c >= a; c--)
            _ = O[c], w = m.get(_), b[c] = w === undefined ? -1 : w, m.set(_, c);
          for (w = a;w <= l; w++)
            _ = r[w], c = m.get(_), c !== undefined && c !== -1 ? (E[c] = i[w], L[c] = o[w], g && (D[c] = g[w]), c = b[c], m.set(_, c)) : o[w]();
          for (c = a;c < S; c++)
            c in E ? (i[c] = E[c], o[c] = L[c], g && (g[c] = D[c], g[c](c))) : i[c] = pt(A);
          i = i.slice(0, f = S), r = O.slice(0);
        }
        return i;
      });
      function A(m) {
        if (o[c] = m, g) {
          const [b, E] = U(c);
          return g[c] = E, e(O[c], b);
        }
        return e(O[c]);
      }
    };
  }
  var Ue = false;
  function Me(t, e) {
    if (Ue && Q.context) {
      const n = Q.context;
      Qt(Ce());
      const r = J(() => t(e || {}));
      return Qt(n), r;
    }
    return J(() => t(e || {}));
  }
  function bt() {
    return true;
  }
  var $e = { get(t, e, n) {
    return e === kt ? n : t.get(e);
  }, has(t, e) {
    return e === kt ? true : t.has(e);
  }, set: bt, deleteProperty: bt, getOwnPropertyDescriptor(t, e) {
    return { configurable: true, enumerable: true, get() {
      return t.get(e);
    }, set: bt, deleteProperty: bt };
  }, ownKeys(t) {
    return t.keys();
  } };
  function Wt(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function Ye() {
    for (let t = 0, e = this.length;t < e; ++t) {
      const n = this[t]();
      if (n !== undefined)
        return n;
    }
  }
  function ce(...t) {
    let e = false;
    for (let f = 0;f < t.length; f++) {
      const g = t[f];
      e = e || !!g && kt in g, t[f] = typeof g == "function" ? (e = true, wt(g)) : g;
    }
    if (Ne && e)
      return new Proxy({ get(f) {
        for (let g = t.length - 1;g >= 0; g--) {
          const O = Wt(t[g])[f];
          if (O !== undefined)
            return O;
        }
      }, has(f) {
        for (let g = t.length - 1;g >= 0; g--)
          if (f in Wt(t[g]))
            return true;
        return false;
      }, keys() {
        const f = [];
        for (let g = 0;g < t.length; g++)
          f.push(...Object.keys(Wt(t[g])));
        return [...new Set(f)];
      } }, $e);
    const n = {}, r = Object.create(null);
    for (let f = t.length - 1;f >= 0; f--) {
      const g = t[f];
      if (!g)
        continue;
      const O = Object.getOwnPropertyNames(g);
      for (let S = O.length - 1;S >= 0; S--) {
        const w = O[S];
        if (w === "__proto__" || w === "constructor")
          continue;
        const c = Object.getOwnPropertyDescriptor(g, w);
        if (!r[w])
          r[w] = c.get ? { enumerable: true, configurable: true, get: Ye.bind(n[w] = [c.get.bind(g)]) } : c.value !== undefined ? c : undefined;
        else {
          const A = n[w];
          A && (c.get ? A.push(c.get.bind(g)) : c.value !== undefined && A.push(() => c.value));
        }
      }
    }
    const i = {}, o = Object.keys(r);
    for (let f = o.length - 1;f >= 0; f--) {
      const g = o[f], O = r[g];
      O && O.get ? Object.defineProperty(i, g, O) : i[g] = O ? O.value : undefined;
    }
    return i;
  }
  function he(t) {
    const e = "fallback" in t && { fallback: () => t.fallback };
    return wt(Ge(() => t.each, t.children, e || undefined));
  }
  var qe = (t) => wt(() => t());
  function Xe({ createElement: t, createTextNode: e, isTextNode: n, replaceText: r, insertNode: i, removeNode: o, setProperty: f, getParentNode: g, getFirstChild: O, getNextSibling: S }) {
    function w(a, l, s, _) {
      if (s !== undefined && !_ && (_ = []), typeof l != "function")
        return c(a, l, _, s);
      X((p) => c(a, l(), p, s), _);
    }
    function c(a, l, s, _, p) {
      for (;typeof s == "function"; )
        s = s();
      if (l === s)
        return s;
      const P = typeof l, d = _ !== undefined;
      if (P === "string" || P === "number")
        if (P === "number" && (l = l.toString()), d) {
          let v = s[0];
          v && n(v) ? r(v, l) : v = e(l), s = b(a, s, _, v);
        } else
          s !== "" && typeof s == "string" ? r(O(a), s = l) : (b(a, s, _, e(l)), s = l);
      else if (l == null || P === "boolean")
        s = b(a, s, _);
      else {
        if (P === "function")
          return X(() => {
            let v = l();
            for (;typeof v == "function"; )
              v = v();
            s = c(a, v, s, _);
          }), () => s;
        if (Array.isArray(l)) {
          const v = [];
          if (A(v, l, p))
            return X(() => s = c(a, v, s, _, true)), () => s;
          if (v.length === 0) {
            const W = b(a, s, _);
            if (d)
              return s = W;
          } else
            Array.isArray(s) ? s.length === 0 ? E(a, v, _) : m(a, s, v) : s == null || s === "" ? E(a, v) : m(a, d && s || [O(a)], v);
          s = v;
        } else {
          if (Array.isArray(s)) {
            if (d)
              return s = b(a, s, _, l);
            b(a, s, null, l);
          } else
            s == null || s === "" || !O(a) ? i(a, l) : L(a, l, O(a));
          s = l;
        }
      }
      return s;
    }
    function A(a, l, s) {
      let _ = false;
      for (let p = 0, P = l.length;p < P; p++) {
        let d = l[p], v;
        if (!(d == null || d === true || d === false))
          if (Array.isArray(d))
            _ = A(a, d) || _;
          else if ((v = typeof d) == "string" || v === "number")
            a.push(e(d));
          else if (v === "function")
            if (s) {
              for (;typeof d == "function"; )
                d = d();
              _ = A(a, Array.isArray(d) ? d : [d]) || _;
            } else
              a.push(d), _ = true;
          else
            a.push(d);
      }
      return _;
    }
    function m(a, l, s) {
      let _ = s.length, p = l.length, P = _, d = 0, v = 0, W = S(l[p - 1]), k = null;
      for (;d < p || v < P; ) {
        if (l[d] === s[v]) {
          d++, v++;
          continue;
        }
        for (;l[p - 1] === s[P - 1]; )
          p--, P--;
        if (p === d) {
          const V = P < _ ? v ? S(s[v - 1]) : s[P - v] : W;
          for (;v < P; )
            i(a, s[v++], V);
        } else if (P === v)
          for (;d < p; )
            (!k || !k.has(l[d])) && o(a, l[d]), d++;
        else if (l[d] === s[P - 1] && s[v] === l[p - 1]) {
          const V = S(l[--p]);
          i(a, s[v++], S(l[d++])), i(a, s[--P], V), l[p] = s[P];
        } else {
          if (!k) {
            k = new Map;
            let q = v;
            for (;q < P; )
              k.set(s[q], q++);
          }
          const V = k.get(l[d]);
          if (V != null)
            if (v < V && V < P) {
              let q = d, st = 1, ot;
              for (;++q < p && q < P && !((ot = k.get(l[q])) == null || ot !== V + st); )
                st++;
              if (st > V - v) {
                const er = l[d];
                for (;v < V; )
                  i(a, s[v++], er);
              } else
                L(a, s[v++], l[d++]);
            } else
              d++;
          else
            o(a, l[d++]);
        }
      }
    }
    function b(a, l, s, _) {
      if (s === undefined) {
        let P;
        for (;P = O(a); )
          o(a, P);
        return _ && i(a, _), "";
      }
      const p = _ || e("");
      if (l.length) {
        let P = false;
        for (let d = l.length - 1;d >= 0; d--) {
          const v = l[d];
          if (p !== v) {
            const W = g(v) === a;
            !P && !d ? W ? L(a, p, v) : i(a, p, s) : W && o(a, v);
          } else
            P = true;
        }
      } else
        i(a, p, s);
      return [p];
    }
    function E(a, l, s) {
      for (let _ = 0, p = l.length;_ < p; _++)
        i(a, l[_], s);
    }
    function L(a, l, s) {
      i(a, l, s), o(a, s);
    }
    function D(a, l, s = {}, _) {
      return l || (l = {}), _ || X(() => s.children = c(a, l.children, s.children)), X(() => l.ref && l.ref(a)), X(() => {
        for (const p in l) {
          if (p === "children" || p === "ref")
            continue;
          const P = l[p];
          P !== s[p] && (f(a, p, P, s[p]), s[p] = P);
        }
      }), s;
    }
    return { render(a, l) {
      let s;
      return pt((_) => {
        s = _, w(l, a());
      }), s;
    }, insert: w, spread(a, l, s) {
      typeof l == "function" ? X((_) => D(a, l(), _, s)) : D(a, l, undefined, s);
    }, createElement: t, createTextNode: e, insertNode: i, setProp(a, l, s, _) {
      return f(a, l, s, _), s;
    }, mergeProps: ce, effect: X, memo: qe, createComponent: Me, use(a, l, s) {
      return J(() => a(l, s));
    } };
  }
  function ze(t) {
    const e = Xe(t);
    return e.mergeProps = ce, e;
  }
  var ge = 6 * 1024 * 1024, je = 64, rr = je, _e = 4 * 1024 * 1024, tt = 64 + _e, Vt = 1024 * 1024, Gt = tt + Vt, de = tt + Vt, Ke = 0, Qe = 8, Ze = 12, Je = 16, tn = 24, en = 28, nn = 32, rn = Qe >> 2, sn = Ze >> 2, on = tn >> 2, ve = en >> 2, ln = Ke >> 3, an = Je >> 3, un = nn >> 3, ir = 1, sr = 2, or = 3, lr = 4, ar = 16, ur = 17, fr = 20, cr = 21, hr = 22, gr = 23, _r = 24, dr = 25, vr = 26, Sr = 27, Er = 32, Or = 33, pr = 34, wr = 35, Pr = 36, Tr = 37, br = 0, Rr = 1, yr = 2, Ar = 3, mr = 4, Ir = 5, Cr = 6, Fr = 7, Nr = 1, xr = 0, Lr = 1, Dr = 2, kr = 3, Hr = 4, Br = 5, Wr = 6, Vr = 7, Gr = 8, Ur = 9, Mr = 32, $r = 33, Yr = 34, qr = 35, Xr = 36, zr = 37, jr = 64, Kr = 65, Qr = 66, Zr = 67, Jr = 68, ti = 69, ei = 70, ni = 96, ri = 97, ii = 128, si = 129, oi = 130, li = 131, ai = 160, ui = 161, fi = 162, ci = -1, fn = 2147483646, cn = 2147483645, K = globalThis.__skal_acquireBridge();
  if (!K || K.byteLength !== ge)
    throw new Error(`Skal: bridge buffer not available (got ${K && K.byteLength})`);
  var hn = new Uint8Array(K), M = new Uint32Array(K), Ut = new BigInt64Array(K), gn = new TextEncoder, ut = 16, _n = 64 + _e >> 2, dn = 16384, vn = _n - 4, Rt = 0n, j = ut, et = tt, yt = ut;
  function Mt() {
    M[rn] = j - ut << 2, M[sn] = et - tt, Rt += 1n, Atomics.store(Ut, ln, Rt), yt = j;
  }
  function Se() {
    Mt();
    const t = Rt, e = performance.now() + 5000;
    for (;!(Atomics.load(Ut, un) >= t); )
      if (performance.now() > e) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    j = ut, et = tt, yt = ut;
  }
  function x(t, e, n, r) {
    let i = j;
    i >= vn && (Se(), i = j), M[i] = t >>> 0, M[i + 1] = e >>> 0, M[i + 2] = n >>> 0, M[i + 3] = r >>> 0, j = i + 4, j - yt >= dn && Mt();
  }
  var ft = 0, ct = 0;
  function At(t) {
    et + t.length * 3 > de && Se();
    const e = et - tt, n = hn.subarray(et, de), { read: r, written: i } = gn.encodeInto(t, n);
    if (r !== t.length)
      throw new Error(`Skal: string too large for heap (${t.length} code units > ${Vt} bytes)`);
    et += i, ft = e, ct = i;
  }
  function $t(t, e) {
    At(e), x(20, t, ft, ct);
  }
  var Yt = false;
  function Sn() {
    Yt = false, j !== yt && Mt();
  }
  function C() {
    Yt || (Yt = true, queueMicrotask(Sn));
  }
  var $ = 1024, T = new Int8Array(256);
  T.fill(-1), T[0] = 0, T[1] = 1, T[2] = 2, T[3] = 3, T[4] = 4, T[5] = 5, T[6] = 6, T[7] = 7, T[8] = 8, T[9] = 9, T[32] = 10, T[33] = 11, T[34] = 12, T[35] = 13, T[36] = 14, T[37] = 15, T[64] = 16, T[65] = 17, T[66] = 18, T[67] = 19, T[68] = 20, T[69] = 21, T[70] = 22, T[96] = 23, T[97] = 24, T[128] = 25, T[129] = 26, T[130] = 27, T[131] = 28, T[160] = 29, T[161] = 30, T[162] = 31;
  var B = 32, mt = new Int32Array($ * B), ht = new Float32Array($ * B), It = new Array($ * B), gt = new Uint8Array($ * B), nt = 6, rt = new Float32Array($ * nt);
  rt.fill(NaN);
  var Ct = new Map, Ee = [], En = 0;
  function On() {
    const t = $ * 2, e = $ * B, n = t * B, r = $ * nt, i = t * nt, o = new Int32Array(n);
    o.set(mt), mt = o;
    const f = new Uint8Array(n);
    f.set(gt), gt = f;
    const g = new Float32Array(n);
    g.set(ht), g.fill(NaN, e), ht = g;
    const O = new Float32Array(i);
    O.set(rt), O.fill(NaN, r), rt = O, It.length = n, $ = t;
  }
  function Ft(t) {
    let e = Ct.get(t);
    if (e === undefined) {
      e = Ee.pop(), e === undefined && (e = En++), e >= $ && On(), Ct.set(t, e);
      const n = e * B;
      gt.fill(0, n, n + B), ht.fill(NaN, n, n + B);
      for (let r = n;r < n + B; r++)
        It[r] = undefined;
    }
    return e;
  }
  function pn(t) {
    const e = Ct.get(t);
    if (e !== undefined) {
      Ct.delete(t), Ee.push(e);
      const n = e * nt;
      rt.fill(NaN, n, n + nt);
    }
  }
  var _t = 0, dt = 0, Nt = new Float32Array(1), qt = new Uint32Array(Nt.buffer);
  function xt(t, e, n) {
    const r = T[e];
    if (r < 0)
      return;
    const i = Ft(t) * B + r, o = n | 0;
    if (gt[i] !== 0 && mt[i] === o) {
      dt++;
      return;
    }
    mt[i] = o, gt[i] = 1, x(16, t, e, o), _t++;
  }
  function wn(t, e, n) {
    const r = T[e];
    if (r < 0)
      return;
    const i = Ft(t) * B + r;
    if (ht[i] === n) {
      dt++;
      return;
    }
    ht[i] = n, Nt[0] = n, x(17, t, e, qt[0]), _t++;
  }
  function Pn(t, e, n) {
    const r = T[e];
    if (r < 0)
      return;
    const i = Ft(t) * B + r;
    if (It[i] === n) {
      dt++;
      return;
    }
    It[i] = n, At(n == null ? "" : String(n)), x(22, t, (e & 255) << 24 | ft & 16777215, ct), _t++;
  }
  function it(t, e, n, r) {
    const i = Ft(t) * nt + n;
    if (rt[i] === r) {
      dt++;
      return;
    }
    rt[i] = r, Nt[0] = r, x(e, t, 0, qt[0]), _t++;
  }
  function Tn(t, e) {
    it(t, 32, 0, e);
  }
  function bn(t, e) {
    it(t, 33, 1, e);
  }
  function Rn(t, e) {
    it(t, 34, 2, e);
  }
  function yn(t, e) {
    it(t, 35, 3, e);
  }
  function An(t, e) {
    it(t, 36, 4, e);
  }
  function mn(t, e) {
    it(t, 37, 5, e);
  }
  var Oe = new Map;
  function In(t) {
    let e = 2166136261;
    for (let n = 0;n < t.length; n++)
      e ^= t.charCodeAt(n), e = Math.imul(e, 16777619) >>> 0;
    return e;
  }
  function vt(t) {
    let e = Oe.get(t);
    return e !== undefined || (e = In(t), At(t), x(23, e, ft, ct), Oe.set(t, e)), e;
  }
  function Cn(t, e) {
    x(4, t, vt(e), 0);
  }
  function pe(t, e, n) {
    x(24, t, vt(e), n >>> 0);
  }
  function we(t, e, n) {
    const r = vt(e);
    Nt[0] = n, x(25, t, r, qt[0]);
  }
  function Fn(t, e, n) {
    const r = vt(e);
    At(n == null ? "" : String(n));
    const i = ft & 16777215, o = ct & 255;
    x(26, t, r, i << 8 | o);
  }
  function Nn(t, e, n) {
    x(27, t, vt(e), n);
  }
  var Xt = new Map, xn = 1;
  function Pe(t) {
    const e = xn++;
    return Xt.set(e, t), e;
  }
  function Ln(t, e, n) {
    x(21, t, e, n);
  }
  var zt = 0n, Te = null, be = ge - Gt, jt = Gt >> 2, Dn = Gt + be >> 2, kn = be / 16 | 0;
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load(Ut, an);
    if (t === zt)
      return;
    const e = jt + (M[on] >> 2);
    let n = jt + (M[ve] >> 2);
    const r = Dn, i = jt;
    let o = kn;
    for (;n !== e && o-- > 0; ) {
      const f = M[n + 1], g = Xt.get(f);
      if (g)
        try {
          g();
        } catch (O) {
          Te = O && (O.stack || O.message || String(O)) || "unknown";
        }
      n += 4, n >= r && (n = i);
    }
    M[ve] = n - i << 2, zt = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: Xt.size, opSeq: Number(Rt), lastEventSeq: Number(zt), lastHandlerError: Te, propWrites: _t, propSkips: dt });
  var hi = 1, Hn = 2;
  function Re() {
    return Hn++;
  }
  var Bn = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4 }, Wn = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"] }, Vn = { opacity: Tn, translationX: bn, translationY: Rn, scaleX: yn, scaleY: An, rotation: mn };
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
    return typeof t == "number" ? t | 0 : t === "fill" ? fn : t === "wrap" ? cn : -1;
  }
  function Mn(t, e, n) {
    if (n == null)
      return;
    const r = typeof n;
    if (r === "function") {
      const i = Pe(n);
      Nn(t.id, e, i), C();
      return;
    }
    if (r === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 && pe(t.id, e, n | 0), we(t.id, e, n), C();
      return;
    }
    if (r === "string") {
      Fn(t.id, e, n), C();
      return;
    }
    if (r === "boolean") {
      pe(t.id, e, n ? 1 : 0), C();
      return;
    }
  }
  function $n(t) {
    const e = [t];
    for (;e.length > 0; ) {
      const n = e.pop();
      pn(n.id);
      let r = n.firstChild;
      for (;r; )
        e.push(r), r = r.nextSibling;
    }
  }
  var Lt = class {
    constructor(t, e, n = false, r = false) {
      this.tag = t, this.id = e, this.isText = n, this.isCustom = r, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, Yn = ze({ createElement(t) {
    const e = Re(), n = Bn[t];
    return n !== undefined ? (x(1, e, n, 0), C(), new Lt(t, e, false, false)) : (Cn(e, t), C(), new Lt(t, e, false, true));
  }, createTextNode(t) {
    const e = Re();
    x(1, e, 3, 0);
    const n = t == null ? "" : String(t);
    n.length > 0 && $t(e, n), C();
    const r = new Lt("#text", e, true);
    return r.text = n, r;
  }, replaceText(t, e) {
    const n = e == null ? "" : String(e);
    t.text !== n && (t.text = n, $t(t.id, n), C());
  }, setProperty(t, e, n, r) {
    if (t.isCustom) {
      Mn(t, e, n);
      return;
    }
    if (e === "onClick" || e === "onclick") {
      if (typeof n == "function") {
        const f = Pe(n);
        Ln(t.id, 1, f), C();
      }
      return;
    }
    if (e === "label" && (t.tag === "button" || t.tag === "text")) {
      const f = n == null ? "" : String(n);
      $t(t.id, f), C();
      return;
    }
    const i = Vn[e];
    if (i !== undefined) {
      typeof n == "number" && (i(t.id, n), C());
      return;
    }
    const o = Wn[e];
    if (o !== undefined) {
      const [f, g] = o;
      if (n == null)
        return;
      switch (g) {
        case "u32":
          typeof n == "number" ? (xt(t.id, f, n | 0), C()) : typeof n == "boolean" && (xt(t.id, f, n ? 1 : 0), C());
          return;
        case "f32":
          typeof n == "number" && (wn(t.id, f, n), C());
          return;
        case "str":
          Pn(t.id, f, String(n)), C();
          return;
        case "color":
          xt(t.id, f, Gn(n)), C();
          return;
        case "dim":
          xt(t.id, f, Un(n)), C();
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
    x(3, t.id, e.id, r), C(), e.parent = t, n ? (e.nextSibling = n, e.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = e : t.firstChild = e, n.prevSibling = e) : (e.prevSibling = t.lastChild, e.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = e : t.firstChild = e, t.lastChild = e);
  }, removeNode(t, e) {
    x(2, e.id, 0, 0), $n(e), C(), e.prevSibling ? e.prevSibling.nextSibling = e.nextSibling : t.firstChild = e.nextSibling, e.nextSibling ? e.nextSibling.prevSibling = e.prevSibling : t.lastChild = e.prevSibling, e.parent = null, e.prevSibling = null, e.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: qn, effect: Xn, memo: gi, createComponent: Dt, createElement: I, createTextNode: _i, insertNode: N, insert: St, spread: di, setProp: h, mergeProps: vi, use: Si } = Yn;
  x(1, 1, 0, 0), C();
  var zn = new Lt("box", 1, false), ye = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], jn = Array.from({ length: 15000 }, (t, e) => ({ author: `@user${e * 2654435761 >>> 17}`, body: ye[e % ye.length], num: e + 1 })), Kn = [50, 200, 500, 1000, 2000, 5000, 1e4], Ae = "#FFF1F5F9", me = "#FF475569", Qn = "#FF22C55E", Zn = "#FFEF4444", Ie = "#FFFFFFFF";
  function Jn(t) {
    const [e, n] = U(0), [r, i] = U(false), [o, f] = U(0), [g, O] = U(false);
    return (() => {
      var S = I("column"), w = I("text"), c = I("text"), A = I("row"), m = I("button"), b = I("button");
      return N(S, w), N(S, c), N(S, A), h(S, "background", "#FFFFFFFF"), h(S, "padding", 12), h(S, "cornerRadius", 10), h(S, "borderWidth", 1), h(S, "borderColor", "#FFE5E5EA"), h(S, "gap", 6), h(w, "fontWeight", 700), h(w, "fontSize", 14), h(w, "color", "#FF1DA1F2"), h(c, "fontSize", 14), h(c, "color", "#FF1F2937"), h(c, "maxLines", 3), h(c, "textOverflow", 1), N(A, m), N(A, b), h(A, "gap", 10), h(m, "fontSize", 12), h(m, "padding", 6), h(m, "cornerRadius", 16), h(m, "onClick", () => {
        const E = !r();
        i(E), n(e() + (E ? 1 : -1));
      }), h(b, "fontSize", 12), h(b, "padding", 6), h(b, "cornerRadius", 16), h(b, "onClick", () => {
        const E = !g();
        O(E), f(o() + (E ? 1 : -1));
      }), Xn((E) => {
        var L = `#${t.num} \xB7 ${t.author}`, D = t.body, a = `\u2665 ${e()}`, l = r() ? Qn : Ae, s = r() ? Ie : me, _ = `\u21A9 ${o()}`, p = g() ? Zn : Ae, P = g() ? Ie : me;
        return L !== E.e && (E.e = h(w, "label", L, E.e)), D !== E.t && (E.t = h(c, "label", D, E.t)), a !== E.a && (E.a = h(m, "label", a, E.a)), l !== E.o && (E.o = h(m, "background", l, E.o)), s !== E.i && (E.i = h(m, "color", s, E.i)), _ !== E.n && (E.n = h(b, "label", _, E.n)), p !== E.s && (E.s = h(b, "background", p, E.s)), P !== E.h && (E.h = h(b, "color", P, E.h)), E;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), S;
    })();
  }
  function tr() {
    const [t, e] = U(0), [n, r] = U("tap +1000 to benchmark fast-path"), [i, o] = U(50), [f, g] = U(""), O = wt(() => jn.slice(0, i()));
    return (() => {
      var S = I("listView"), w = I("greeting"), c = I("shimmerFromColors"), A = I("greeting"), m = I("qrImageView"), b = I("stickers"), E = I("greeting"), L = I("greeting"), D = I("greeting"), a = I("box"), l = I("row"), s = I("button"), _ = I("button"), p = I("button"), P = I("row");
      return N(S, w), N(S, c), N(S, m), N(S, b), N(S, a), N(S, l), N(S, p), N(S, P), h(S, "background", "#FFFAFAFA"), h(S, "padding", 16), h(S, "gap", 12), h(w, "name", "Skal"), h(w, "color", "#FF1DA1F2"), h(w, "fontSize", 20), N(c, A), h(c, "baseColor", 4290624957), h(c, "highlightColor", 4292927712), h(c, "period", 1500), h(A, "name", "loading\u2026"), h(A, "color", "#FF333333"), h(A, "fontSize", 28), h(m, "data", "https://skal.dev"), h(m, "size", 200), N(b, E), N(b, L), N(b, D), h(b, "background", 4294959234), h(b, "gap", 6), h(b, "padding", 10), h(E, "name", "multi-child A"), h(E, "color", "#FF6B4F00"), h(E, "fontSize", 14), h(L, "name", "multi-child B"), h(L, "color", "#FF6B4F00"), h(L, "fontSize", 14), h(D, "name", "multi-child C"), h(D, "color", "#FF6B4F00"), h(D, "fontSize", 14), h(a, "background", "#FF1DA1F2"), h(a, "padding", 12), h(a, "cornerRadius", 8), St(a, () => `Count: ${t()}`), N(l, s), N(l, _), h(l, "gap", 8), h(s, "label", "Increment"), h(s, "onClick", () => e(t() + 1)), h(_, "label", "Decrement"), h(_, "onClick", () => e(t() - 1)), h(p, "label", "+1000 (benchmark)"), h(p, "onClick", () => {
        const d = t(), v = performance.now();
        let W = 0, k = -1, V = "";
        try {
          for (;W < 1000; W++)
            e(t() + 1);
        } catch (ot) {
          k = W, V = ot && (ot.message || String(ot)) || "unknown";
        }
        const q = (performance.now() - v).toFixed(3), st = t() - d;
        k >= 0 ? r(`crashed @${k}: ${V} \xB7 delta=${st}`) : r(`+1000 ${q}ms \xB7 iter=${W} delta=${st}`);
      }), St(S, n, P), St(P, Dt(he, { each: Kn, children: (d) => (() => {
        var v = I("button");
        return h(v, "label", `${d}`), h(v, "onClick", () => {
          const W = performance.now();
          try {
            o(d), g(`set to ${d} in ${(performance.now() - W).toFixed(3)} ms`);
          } catch (k) {
            g(`ERROR @ ${d}: ${k && (k.message || String(k)) || "unknown"}`);
          }
        }), v;
      })() })), St(S, f, null), St(S, Dt(he, { get each() {
        return O();
      }, children: (d) => Dt(Jn, { get author() {
        return d.author;
      }, get body() {
        return d.body;
      }, get num() {
        return d.num;
      } }) }), null), S;
    })();
  }
  qn(() => Dt(tr, {}), zn);
})();
})
