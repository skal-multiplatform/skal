// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var Q = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Mt(this.context.count);
  }, getNextContextId() {
    return Mt(this.context.count++);
  } };
  function Mt(t) {
    const r = String(t), n = r.length - 1;
    return Q.context.id + (n ? String.fromCharCode(96 + n) : "") + r;
  }
  function _t(t) {
    Q.context = t;
  }
  function kr() {
    return { ...Q.context, id: Q.getNextContextId(), count: 0 };
  }
  var Ir = (t, r) => t === r, bt = Symbol("solid-proxy"), Nr = typeof Proxy == "function", Lr = Symbol("solid-track"), Qe = { equals: Ir }, Gt = null, Ut = Qt, le = 1, De = 2, Xt = { owned: null, cleanups: null, context: null, owner: null }, M = null, x = null, ze = null, Te = null, X = null, K = null, te = null, Ze = 0;
  function et(t, r) {
    const n = X, l = M, s = t.length === 0, f = r === undefined ? l : r, w = s ? Xt : { owned: null, cleanups: null, context: f ? f.context : null, owner: f }, E = s ? t : () => t(() => xe(() => Fe(w)));
    M = w, X = null;
    try {
      return de(E, true);
    } finally {
      X = n, M = l;
    }
  }
  function V(t, r) {
    r = r ? Object.assign({}, Qe, r) : Qe;
    const n = { value: t, observers: null, observerSlots: null, comparator: r.equals || undefined }, l = (s) => (typeof s == "function" && (x && x.running && x.sources.has(n) ? s = s(n.tValue) : s = s(n.value)), qt(n, s));
    return [jt.bind(n), l];
  }
  function he(t, r, n) {
    const l = Et(t, r, false, le);
    ze && x && x.running ? K.push(l) : Ve(l);
  }
  function Dr(t, r, n) {
    Ut = Hr;
    const l = Et(t, r, false, le), s = vt && Vr(vt);
    s && (l.suspense = s), (!n || !n.render) && (l.user = true), te ? te.push(l) : Ve(l);
  }
  function tt(t, r, n) {
    n = n ? Object.assign({}, Qe, n) : Qe;
    const l = Et(t, r, true, 0);
    return l.observers = null, l.observerSlots = null, l.comparator = n.equals || undefined, ze && x && x.running ? (l.tState = le, K.push(l)) : Ve(l), jt.bind(l);
  }
  function xe(t) {
    if (!Te && X === null)
      return t();
    const r = X;
    X = null;
    try {
      return Te ? Te.untrack(t) : t();
    } finally {
      X = r;
    }
  }
  function Yt(t) {
    return M === null || (M.cleanups === null ? M.cleanups = [t] : M.cleanups.push(t)), t;
  }
  function zr(t) {
    if (x && x.running)
      return t(), x.done;
    const r = X, n = M;
    return Promise.resolve().then(() => {
      X = r, M = n;
      let l;
      return (ze || vt) && (l = x || (x = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), l.done || (l.done = new Promise((s) => l.resolve = s)), l.running = true), de(t, false), X = M = null, l ? l.done : undefined;
    });
  }
  var [xi, Jt] = V(false);
  function Vr(t) {
    let r;
    return M && M.context && (r = M.context[t.id]) !== undefined ? r : t.defaultValue;
  }
  var vt;
  function jt() {
    const t = x && x.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === le)
        Ve(this);
      else {
        const r = K;
        K = null, de(() => rt(this), false), K = r;
      }
    if (X) {
      const r = this.observers ? this.observers.length : 0;
      X.sources ? (X.sources.push(this), X.sourceSlots.push(r)) : (X.sources = [this], X.sourceSlots = [r]), this.observers ? (this.observers.push(X), this.observerSlots.push(X.sources.length - 1)) : (this.observers = [X], this.observerSlots = [X.sources.length - 1]);
    }
    return t && x.sources.has(this) ? this.tValue : this.value;
  }
  function qt(t, r, n) {
    let l = x && x.running && x.sources.has(t) ? t.tValue : t.value;
    if (!t.comparator || !t.comparator(l, r)) {
      if (x) {
        const s = x.running;
        (s || !n && x.sources.has(t)) && (x.sources.add(t), t.tValue = r), s || (t.value = r);
      } else
        t.value = r;
      t.observers && t.observers.length && de(() => {
        for (let s = 0;s < t.observers.length; s += 1) {
          const f = t.observers[s], w = x && x.running;
          w && x.disposed.has(f) || ((w ? !f.tState : !f.state) && (f.pure ? K.push(f) : te.push(f), f.observers && Zt(f)), w ? f.tState = le : f.state = le);
        }
        if (K.length > 1e6)
          throw K = [], new Error;
      }, false);
    }
    return r;
  }
  function Ve(t) {
    if (!t.fn)
      return;
    Fe(t);
    const r = Ze;
    Kt(t, x && x.running && x.sources.has(t) ? t.tValue : t.value, r), x && !x.running && x.sources.has(t) && queueMicrotask(() => {
      de(() => {
        x && (x.running = true), X = M = t, Kt(t, t.tValue, r), X = M = null;
      }, false);
    });
  }
  function Kt(t, r, n) {
    let l;
    const s = M, f = X;
    X = M = t;
    try {
      l = t.fn(r);
    } catch (w) {
      return t.pure && (x && x.running ? (t.tState = le, t.tOwned && t.tOwned.forEach(Fe), t.tOwned = undefined) : (t.state = le, t.owned && t.owned.forEach(Fe), t.owned = null)), t.updatedAt = n + 1, pt(w);
    } finally {
      X = f, M = s;
    }
    (!t.updatedAt || t.updatedAt <= n) && (t.updatedAt != null && ("observers" in t) ? qt(t, l, true) : x && x.running && t.pure ? (x.sources.has(t) || (t.value = l), x.sources.add(t), t.tValue = l) : t.value = l, t.updatedAt = n);
  }
  function Et(t, r, n, l = le, s) {
    const f = { fn: t, state: l, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: r, owner: M, context: M ? M.context : null, pure: n };
    if (x && x.running && (f.state = 0, f.tState = l), M === null || M !== Xt && (x && x.running && M.pure ? M.tOwned ? M.tOwned.push(f) : M.tOwned = [f] : M.owned ? M.owned.push(f) : M.owned = [f]), Te && f.fn) {
      const w = f.fn, [E, A] = V(undefined, { equals: false }), C = Te.factory(w, A);
      Yt(() => C.dispose());
      let T;
      const m = () => zr(A).then(() => {
        T && (T.dispose(), T = undefined);
      });
      f.fn = ($) => (E(), x && x.running ? (T || (T = Te.factory(w, m)), T.track($)) : C.track($));
    }
    return f;
  }
  function We(t) {
    const r = x && x.running;
    if ((r ? t.tState : t.state) === 0)
      return;
    if ((r ? t.tState : t.state) === De)
      return rt(t);
    if (t.suspense && xe(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const n = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < Ze); ) {
      if (r && x.disposed.has(t))
        return;
      (r ? t.tState : t.state) && n.push(t);
    }
    for (let l = n.length - 1;l >= 0; l--) {
      if (t = n[l], r) {
        let s = t, f = n[l + 1];
        for (;(s = s.owner) && s !== f; )
          if (x.disposed.has(s))
            return;
      }
      if ((r ? t.tState : t.state) === le)
        Ve(t);
      else if ((r ? t.tState : t.state) === De) {
        const s = K;
        K = null, de(() => rt(t, n[0]), false), K = s;
      }
    }
  }
  function de(t, r) {
    if (K)
      return t();
    let n = false;
    r || (K = []), te ? n = true : te = [], Ze++;
    try {
      const l = t();
      return Wr(n), l;
    } catch (l) {
      n || (te = null), K = null, pt(l);
    }
  }
  function Wr(t) {
    if (K && (ze && x && x.running ? Br(K) : Qt(K), K = null), t)
      return;
    let r;
    if (x) {
      if (!x.promises.size && !x.queue.size) {
        const { sources: l, disposed: s } = x;
        te.push.apply(te, x.effects), r = x.resolve;
        for (const f of te)
          "tState" in f && (f.state = f.tState), delete f.tState;
        x = null, de(() => {
          for (const f of s)
            Fe(f);
          for (const f of l) {
            if (f.value = f.tValue, f.owned)
              for (let w = 0, E = f.owned.length;w < E; w++)
                Fe(f.owned[w]);
            f.tOwned && (f.owned = f.tOwned), delete f.tValue, delete f.tOwned, f.tState = 0;
          }
          Jt(false);
        }, false);
      } else if (x.running) {
        x.running = false, x.effects.push.apply(x.effects, te), te = null, Jt(true);
        return;
      }
    }
    const n = te;
    te = null, n.length && de(() => Ut(n), false), r && r();
  }
  function Qt(t) {
    for (let r = 0;r < t.length; r++)
      We(t[r]);
  }
  function Br(t) {
    for (let r = 0;r < t.length; r++) {
      const n = t[r], l = x.queue;
      l.has(n) || (l.add(n), ze(() => {
        l.delete(n), de(() => {
          x.running = true, We(n);
        }, false), x && (x.running = false);
      }));
    }
  }
  function Hr(t) {
    let r, n = 0;
    for (r = 0;r < t.length; r++) {
      const l = t[r];
      l.user ? t[n++] = l : We(l);
    }
    if (Q.context) {
      if (Q.count) {
        Q.effects || (Q.effects = []), Q.effects.push(...t.slice(0, n));
        return;
      }
      _t();
    }
    for (Q.effects && (Q.done || !Q.count) && (t = [...Q.effects, ...t], n += Q.effects.length, delete Q.effects), r = 0;r < n; r++)
      We(t[r]);
  }
  function rt(t, r) {
    const n = x && x.running;
    n ? t.tState = 0 : t.state = 0;
    for (let l = 0;l < t.sources.length; l += 1) {
      const s = t.sources[l];
      if (s.sources) {
        const f = n ? s.tState : s.state;
        f === le ? s !== r && (!s.updatedAt || s.updatedAt < Ze) && We(s) : f === De && rt(s, r);
      }
    }
  }
  function Zt(t) {
    const r = x && x.running;
    for (let n = 0;n < t.observers.length; n += 1) {
      const l = t.observers[n];
      (r ? !l.tState : !l.state) && (r ? l.tState = De : l.state = De, l.pure ? K.push(l) : te.push(l), l.observers && Zt(l));
    }
  }
  function Fe(t) {
    let r;
    if (t.sources)
      for (;t.sources.length; ) {
        const n = t.sources.pop(), l = t.sourceSlots.pop(), s = n.observers;
        if (s && s.length) {
          const f = s.pop(), w = n.observerSlots.pop();
          l < s.length && (f.sourceSlots[w] = l, s[l] = f, n.observerSlots[l] = w);
        }
      }
    if (t.tOwned) {
      for (r = t.tOwned.length - 1;r >= 0; r--)
        Fe(t.tOwned[r]);
      delete t.tOwned;
    }
    if (x && x.running && t.pure)
      er(t, true);
    else if (t.owned) {
      for (r = t.owned.length - 1;r >= 0; r--)
        Fe(t.owned[r]);
      t.owned = null;
    }
    if (t.cleanups) {
      for (r = t.cleanups.length - 1;r >= 0; r--)
        t.cleanups[r]();
      t.cleanups = null;
    }
    x && x.running ? t.tState = 0 : t.state = 0;
  }
  function er(t, r) {
    if (r || (t.tState = 0, x.disposed.add(t)), t.owned)
      for (let n = 0;n < t.owned.length; n++)
        er(t.owned[n]);
  }
  function Mr(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function tr(t, r, n) {
    try {
      for (const l of r)
        l(t);
    } catch (l) {
      pt(l, n && n.owner || null);
    }
  }
  function pt(t, r = M) {
    const n = Gt && r && r.context && r.context[Gt], l = Mr(t);
    if (!n)
      throw l;
    te ? te.push({ fn() {
      tr(l, n, r);
    }, state: le }) : tr(l, n, r);
  }
  var Gr = Symbol("fallback");
  function rr(t) {
    for (let r = 0;r < t.length; r++)
      t[r]();
  }
  function Ur(t, r, n = {}) {
    let l = [], s = [], f = [], w = 0, E = r.length > 1 ? [] : null;
    return Yt(() => rr(f)), () => {
      let A = t() || [], C = A.length, T, m;
      return A[Lr], xe(() => {
        let F, _, b, y, D, p, v, a, u;
        if (C === 0)
          w !== 0 && (rr(f), f = [], l = [], s = [], w = 0, E && (E = [])), n.fallback && (l = [Gr], s[0] = et((g) => (f[0] = g, n.fallback())), w = 1);
        else if (w === 0) {
          for (s = new Array(C), m = 0;m < C; m++)
            l[m] = A[m], s[m] = et($);
          w = C;
        } else {
          for (b = new Array(C), y = new Array(C), E && (D = new Array(C)), p = 0, v = Math.min(w, C);p < v && l[p] === A[p]; p++)
            ;
          for (v = w - 1, a = C - 1;v >= p && a >= p && l[v] === A[a]; v--, a--)
            b[a] = s[v], y[a] = f[v], E && (D[a] = E[v]);
          for (F = new Map, _ = new Array(a + 1), m = a;m >= p; m--)
            u = A[m], T = F.get(u), _[m] = T === undefined ? -1 : T, F.set(u, m);
          for (T = p;T <= v; T++)
            u = l[T], m = F.get(u), m !== undefined && m !== -1 ? (b[m] = s[T], y[m] = f[T], E && (D[m] = E[T]), m = _[m], F.set(u, m)) : f[T]();
          for (m = p;m < C; m++)
            m in b ? (s[m] = b[m], f[m] = y[m], E && (E[m] = D[m], E[m](m))) : s[m] = et($);
          s = s.slice(0, w = C), l = A.slice(0);
        }
        return s;
      });
      function $(F) {
        if (f[m] = F, E) {
          const [_, b] = V(m);
          return E[m] = b, r(A[m], _);
        }
        return r(A[m]);
      }
    };
  }
  var Xr = false;
  function Yr(t, r) {
    if (Xr && Q.context) {
      const n = Q.context;
      _t(kr());
      const l = xe(() => t(r || {}));
      return _t(n), l;
    }
    return xe(() => t(r || {}));
  }
  function nt() {
    return true;
  }
  var Jr = { get(t, r, n) {
    return r === bt ? n : t.get(r);
  }, has(t, r) {
    return r === bt ? true : t.has(r);
  }, set: nt, deleteProperty: nt, getOwnPropertyDescriptor(t, r) {
    return { configurable: true, enumerable: true, get() {
      return t.get(r);
    }, set: nt, deleteProperty: nt };
  }, ownKeys(t) {
    return t.keys();
  } };
  function St(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function jr() {
    for (let t = 0, r = this.length;t < r; ++t) {
      const n = this[t]();
      if (n !== undefined)
        return n;
    }
  }
  function nr(...t) {
    let r = false;
    for (let w = 0;w < t.length; w++) {
      const E = t[w];
      r = r || !!E && bt in E, t[w] = typeof E == "function" ? (r = true, tt(E)) : E;
    }
    if (Nr && r)
      return new Proxy({ get(w) {
        for (let E = t.length - 1;E >= 0; E--) {
          const A = St(t[E])[w];
          if (A !== undefined)
            return A;
        }
      }, has(w) {
        for (let E = t.length - 1;E >= 0; E--)
          if (w in St(t[E]))
            return true;
        return false;
      }, keys() {
        const w = [];
        for (let E = 0;E < t.length; E++)
          w.push(...Object.keys(St(t[E])));
        return [...new Set(w)];
      } }, Jr);
    const n = {}, l = Object.create(null);
    for (let w = t.length - 1;w >= 0; w--) {
      const E = t[w];
      if (!E)
        continue;
      const A = Object.getOwnPropertyNames(E);
      for (let C = A.length - 1;C >= 0; C--) {
        const T = A[C];
        if (T === "__proto__" || T === "constructor")
          continue;
        const m = Object.getOwnPropertyDescriptor(E, T);
        if (!l[T])
          l[T] = m.get ? { enumerable: true, configurable: true, get: jr.bind(n[T] = [m.get.bind(E)]) } : m.value !== undefined ? m : undefined;
        else {
          const $ = n[T];
          $ && (m.get ? $.push(m.get.bind(E)) : m.value !== undefined && $.push(() => m.value));
        }
      }
    }
    const s = {}, f = Object.keys(l);
    for (let w = f.length - 1;w >= 0; w--) {
      const E = f[w], A = l[E];
      A && A.get ? Object.defineProperty(s, E, A) : s[E] = A ? A.value : undefined;
    }
    return s;
  }
  function ie(t) {
    const r = "fallback" in t && { fallback: () => t.fallback };
    return tt(Ur(() => t.each, t.children, r || undefined));
  }
  var qr = (t) => tt(() => t());
  function Kr({ createElement: t, createTextNode: r, isTextNode: n, replaceText: l, insertNode: s, removeNode: f, setProperty: w, getParentNode: E, getFirstChild: A, getNextSibling: C }) {
    function T(p, v, a, u) {
      if (a !== undefined && !u && (u = []), typeof v != "function")
        return m(p, v, u, a);
      he((g) => m(p, v(), g, a), u);
    }
    function m(p, v, a, u, g) {
      for (;typeof a == "function"; )
        a = a();
      if (v === a)
        return a;
      const R = typeof v, P = u !== undefined;
      if (R === "string" || R === "number")
        if (R === "number" && (v = v.toString()), P) {
          let I = a[0];
          I && n(I) ? l(I, v) : I = r(v), a = _(p, a, u, I);
        } else
          a !== "" && typeof a == "string" ? l(A(p), a = v) : (_(p, a, u, r(v)), a = v);
      else if (v == null || R === "boolean")
        a = _(p, a, u);
      else {
        if (R === "function")
          return he(() => {
            let I = v();
            for (;typeof I == "function"; )
              I = I();
            a = m(p, I, a, u);
          }), () => a;
        if (Array.isArray(v)) {
          const I = [];
          if ($(I, v, g))
            return he(() => a = m(p, I, a, u, true)), () => a;
          if (I.length === 0) {
            const Z = _(p, a, u);
            if (P)
              return a = Z;
          } else
            Array.isArray(a) ? a.length === 0 ? b(p, I, u) : F(p, a, I) : a == null || a === "" ? b(p, I) : F(p, P && a || [A(p)], I);
          a = I;
        } else {
          if (Array.isArray(a)) {
            if (P)
              return a = _(p, a, u, v);
            _(p, a, null, v);
          } else
            a == null || a === "" || !A(p) ? s(p, v) : y(p, v, A(p));
          a = v;
        }
      }
      return a;
    }
    function $(p, v, a) {
      let u = false;
      for (let g = 0, R = v.length;g < R; g++) {
        let P = v[g], I;
        if (!(P == null || P === true || P === false))
          if (Array.isArray(P))
            u = $(p, P) || u;
          else if ((I = typeof P) == "string" || I === "number")
            p.push(r(P));
          else if (I === "function")
            if (a) {
              for (;typeof P == "function"; )
                P = P();
              u = $(p, Array.isArray(P) ? P : [P]) || u;
            } else
              p.push(P), u = true;
          else
            p.push(P);
      }
      return u;
    }
    function F(p, v, a) {
      let u = a.length, g = v.length, R = u, P = 0, I = 0, Z = C(v[g - 1]), J = null;
      for (;P < g || I < R; ) {
        if (v[P] === a[I]) {
          P++, I++;
          continue;
        }
        for (;v[g - 1] === a[R - 1]; )
          g--, R--;
        if (g === P) {
          const ae = R < u ? I ? C(a[I - 1]) : a[R - I] : Z;
          for (;I < R; )
            s(p, a[I++], ae);
        } else if (R === I)
          for (;P < g; )
            (!J || !J.has(v[P])) && f(p, v[P]), P++;
        else if (v[P] === a[R - 1] && a[I] === v[g - 1]) {
          const ae = C(v[--g]);
          s(p, a[I++], C(v[P++])), s(p, a[--R], ae), v[g] = a[R];
        } else {
          if (!J) {
            J = new Map;
            let ge = I;
            for (;ge < R; )
              J.set(a[ge], ge++);
          }
          const ae = J.get(v[P]);
          if (ae != null)
            if (I < ae && ae < R) {
              let ge = P, Je = 1, je;
              for (;++ge < g && ge < R && !((je = J.get(v[ge])) == null || je !== ae + Je); )
                Je++;
              if (Je > ae - I) {
                const Bt = v[P];
                for (;I < ae; )
                  s(p, a[I++], Bt);
              } else
                y(p, a[I++], v[P++]);
            } else
              P++;
          else
            f(p, v[P++]);
        }
      }
    }
    function _(p, v, a, u) {
      if (a === undefined) {
        let R;
        for (;R = A(p); )
          f(p, R);
        return u && s(p, u), "";
      }
      const g = u || r("");
      if (v.length) {
        let R = false;
        for (let P = v.length - 1;P >= 0; P--) {
          const I = v[P];
          if (g !== I) {
            const Z = E(I) === p;
            !R && !P ? Z ? y(p, g, I) : s(p, g, a) : Z && f(p, I);
          } else
            R = true;
        }
      } else
        s(p, g, a);
      return [g];
    }
    function b(p, v, a) {
      for (let u = 0, g = v.length;u < g; u++)
        s(p, v[u], a);
    }
    function y(p, v, a) {
      s(p, v, a), f(p, a);
    }
    function D(p, v, a = {}, u) {
      return v || (v = {}), u || he(() => a.children = m(p, v.children, a.children)), he(() => v.ref && v.ref(p)), he(() => {
        for (const g in v) {
          if (g === "children" || g === "ref")
            continue;
          const R = v[g];
          R !== a[g] && (w(p, g, R, a[g]), a[g] = R);
        }
      }), a;
    }
    return { render(p, v) {
      let a;
      return et((u) => {
        a = u, T(v, p());
      }), a;
    }, insert: T, spread(p, v, a) {
      typeof v == "function" ? he((u) => D(p, v(), u, a)) : D(p, v, undefined, a);
    }, createElement: t, createTextNode: r, insertNode: s, setProp(p, v, a, u) {
      return w(p, v, a, u), a;
    }, mergeProps: nr, effect: he, memo: qr, createComponent: Yr, use(p, v, a) {
      return xe(() => p(v, a));
    } };
  }
  function Qr(t) {
    const r = Kr(t);
    return r.mergeProps = nr, r;
  }
  var ir = 6 * 1024 * 1024, Zr = 64, Ci = Zr, or = 4 * 1024 * 1024, Ce = 64 + or, wt = 768 * 1024, Rt = Ce + wt, en = 256 * 1024, mt = Rt + en, ar = Ce + wt, tn = 0, rn = 8, nn = 12, on = 16, an = 24, ln = 28, sn = 32, cn = 40, un = 44, fn = rn >> 2, dn = nn >> 2, gn = an >> 2, lr = ln >> 2, hn = cn >> 2;
  un >> 2;
  var Fn = tn >> 3, _n = on >> 3, bn = sn >> 3, Oi = 1, Ai = 2, yi = 3, $i = 4, ki = 16, Ii = 17, Ni = 20, Li = 21, Di = 22, zi = 23, Vi = 24, Wi = 25, Bi = 26, Hi = 27, Mi = 28, Gi = 29, Ui = 30, Xi = 31, Yi = 32, Ji = 33, ji = 34, qi = 35, Ki = 36, Qi = 37, Zi = 38, eo = 39, to = 0, ro = 1, no = 2, io = 3, oo = 4, ao = 5, lo = 6, so = 7, co = 9, uo = 10, fo = 11, go = 12, ho = 13, Fo = 14, _o = 15, bo = 16, vo = 17, Eo = 18, po = 19, So = 20, wo = 21, Ro = 22, mo = 23, Po = 24, To = 25, xo = 26, Co = 27, Oo = 28, Ao = 29, yo = 30, $o = 31, ko = 32, Io = 33, No = 34, Lo = 1, Do = 2, zo = 3, Vo = 4, Wo = 5, Bo = 6, Ho = 7, Mo = 8, Go = 9, Uo = 10, Xo = 11, Yo = 12, Jo = 13, jo = 14, qo = 15, Ko = 16, Qo = 17, Zo = 18, ea = 19, ta = 20, ra = 0, na = 1, ia = 2, oa = 3, aa = 4, la = 5, sa = 6, ca = 7, ua = 0, fa = 1, da = 2, ga = 3, ha = 4, Fa = 5, _a = 6, ba = 7, va = 8, Ea = 9, pa = 10, Sa = 11, wa = 12, Ra = 13, ma = 14, Pa = 15, Ta = 16, xa = 32, Ca = 33, Oa = 34, Aa = 35, ya = 36, $a = 37, ka = 64, Ia = 65, Na = 66, La = 67, Da = 68, za = 69, Va = 70, Wa = 71, Ba = 72, Ha = 73, Ma = 96, Ga = 97, Ua = 98, Xa = 99, Ya = 128, Ja = 129, ja = 130, qa = 131, Ka = 132, Qa = 133, Za = 134, el = 135, tl = 136, rl = 137, nl = 160, il = 161, ol = 162, al = 163, ll = 164, sl = 165, cl = 166, ul = 167, fl = 168, dl = 169, gl = 170, hl = 171, Fl = 172, _l = 173, bl = 174, vl = 175, El = -1, vn = 2147483646, En = 2147483645, ve = globalThis.__skal_acquireBridge();
  if (!ve || ve.byteLength !== ir)
    throw new Error(`Skal: bridge buffer not available (got ${ve && ve.byteLength})`);
  var sr = new Uint8Array(ve), ne = new Uint32Array(ve), Pt = new BigInt64Array(ve), pn = new TextEncoder, Be = 16, Sn = 64 + or >> 2, wn = 16384, Rn = Sn - 4, it = 0n, _e = Be, Oe = Ce, ot = Be;
  function Tt() {
    ne[fn] = _e - Be << 2, ne[dn] = Oe - Ce, it += 1n, Atomics.store(Pt, Fn, it), ot = _e;
  }
  function cr() {
    Tt();
    const t = it, r = performance.now() + 5000;
    for (;!(Atomics.load(Pt, bn) >= t); )
      if (performance.now() > r) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    _e = Be, Oe = Ce, ot = Be;
  }
  function G(t, r, n, l) {
    let s = _e;
    s >= Rn && (cr(), s = _e), ne[s] = t >>> 0, ne[s + 1] = r >>> 0, ne[s + 2] = n >>> 0, ne[s + 3] = l >>> 0, _e = s + 4, _e - ot >= wn && Tt();
  }
  var Ee = 0, pe = 0;
  function Ae(t) {
    Oe + t.length * 3 > ar && cr();
    const r = Oe - Ce, n = sr.subarray(Oe, ar), { read: l, written: s } = pn.encodeInto(t, n);
    if (l !== t.length)
      throw new Error(`Skal: string too large for heap (${t.length} code units > ${wt} bytes)`);
    Oe += s, Ee = r, pe = s;
  }
  function xt(t, r) {
    Ae(r), G(20, t, Ee, pe);
  }
  var Ct = false;
  function mn() {
    Ct = false, _e !== ot && Tt();
  }
  function B() {
    Ct || (Ct = true, queueMicrotask(mn));
  }
  var ue = 1024, O = new Int8Array(256);
  O.fill(-1), O[0] = 0, O[1] = 1, O[2] = 2, O[3] = 3, O[4] = 4, O[5] = 5, O[6] = 6, O[7] = 7, O[8] = 8, O[9] = 9, O[32] = 10, O[33] = 11, O[34] = 12, O[35] = 13, O[36] = 14, O[37] = 15, O[64] = 16, O[65] = 17, O[66] = 18, O[67] = 19, O[68] = 20, O[69] = 21, O[70] = 22, O[96] = 23, O[97] = 24, O[128] = 25, O[129] = 26, O[130] = 27, O[131] = 28, O[160] = 29, O[161] = 30, O[162] = 31, O[10] = 32, O[11] = 33, O[12] = 34, O[13] = 35, O[14] = 36, O[15] = 37, O[16] = 38, O[132] = 39, O[133] = 40, O[134] = 41, O[135] = 42, O[136] = 43, O[163] = 44, O[164] = 45, O[165] = 46, O[166] = 47, O[71] = 48, O[98] = 49, O[137] = 50, O[72] = 51, O[167] = 52, O[168] = 53, O[169] = 54, O[170] = 55, O[171] = 56, O[172] = 57, O[173] = 58, O[174] = 59, O[73] = 60, O[99] = 61, O[175] = 62;
  var oe = 64, at = new Int32Array(ue * oe), He = new Float32Array(ue * oe), lt = new Array(ue * oe), Me = new Uint8Array(ue * oe), ye = 6, $e = new Float32Array(ue * ye);
  $e.fill(NaN);
  var st = new Map, ur = [], Pn = 0;
  function Tn() {
    const t = ue * 2, r = ue * oe, n = t * oe, l = ue * ye, s = t * ye, f = new Int32Array(n);
    f.set(at), at = f;
    const w = new Uint8Array(n);
    w.set(Me), Me = w;
    const E = new Float32Array(n);
    E.set(He), E.fill(NaN, r), He = E;
    const A = new Float32Array(s);
    A.set($e), A.fill(NaN, l), $e = A, lt.length = n, ue = t;
  }
  function ct(t) {
    let r = st.get(t);
    if (r === undefined) {
      r = ur.pop(), r === undefined && (r = Pn++), r >= ue && Tn(), st.set(t, r);
      const n = r * oe;
      Me.fill(0, n, n + oe), He.fill(NaN, n, n + oe);
      for (let l = n;l < n + oe; l++)
        lt[l] = undefined;
    }
    return r;
  }
  var fr = new Map, dr = new Map, gr = new Map, ke = new Map;
  function xn(t) {
    const r = st.get(t);
    if (r !== undefined) {
      st.delete(t), ur.push(r);
      const n = r * ye;
      $e.fill(NaN, n, n + ye);
    }
    fr.delete(t), dr.delete(t), gr.delete(t), Gn(t);
  }
  var se = 0, be = 0, Ie = new Float32Array(1), Ge = new Uint32Array(Ie.buffer);
  function re(t, r, n) {
    const l = n | 0, s = O[r];
    if (s < 0) {
      G(16, t, r, l), se++;
      return;
    }
    const f = ct(t) * oe + s;
    if (Me[f] !== 0 && at[f] === l) {
      be++;
      return;
    }
    at[f] = l, Me[f] = 1, G(16, t, r, l), se++;
  }
  function hr(t, r, n) {
    const l = O[r];
    if (l < 0) {
      Ie[0] = n, G(17, t, r, Ge[0]), se++;
      return;
    }
    const s = ct(t) * oe + l;
    if (He[s] === n) {
      be++;
      return;
    }
    He[s] = n, Ie[0] = n, G(17, t, r, Ge[0]), se++;
  }
  function Cn(t, r, n) {
    const l = O[r];
    if (l < 0) {
      Ae(n == null ? "" : String(n)), G(22, t, (r & 255) << 24 | Ee & 16777215, pe), se++;
      return;
    }
    const s = ct(t) * oe + l;
    if (lt[s] === n) {
      be++;
      return;
    }
    lt[s] = n, Ae(n == null ? "" : String(n)), G(22, t, (r & 255) << 24 | Ee & 16777215, pe), se++;
  }
  function Ne(t, r, n, l) {
    const s = ct(t) * ye + n;
    if ($e[s] === l) {
      be++;
      return;
    }
    $e[s] = l, Ie[0] = l, G(r, t, 0, Ge[0]), se++;
  }
  function On(t, r) {
    Ne(t, 32, 0, r);
  }
  function An(t, r) {
    Ne(t, 33, 1, r);
  }
  function yn(t, r) {
    Ne(t, 34, 2, r);
  }
  function $n(t, r) {
    Ne(t, 35, 3, r);
  }
  function kn(t, r) {
    Ne(t, 36, 4, r);
  }
  function In(t, r) {
    Ne(t, 37, 5, r);
  }
  var Nn = { material: 0, cupertino: 1, adaptive: 2 }, Ln = { light: 0, dark: 1 };
  function Dn(t, r) {
    G(38, typeof t == "string" ? Nn[t] ?? 0 : t | 0, typeof r == "string" ? Ln[r] ?? 0 : r | 0, 0), B();
  }
  function zn(t) {
    G(39, t, 0, 0), B();
  }
  function Fr(t) {
    return ut(1, "showDialog", [JSON.stringify(t || {})]);
  }
  function Vn(t) {
    return ut(1, "showActionSheet", [JSON.stringify(t || {})]);
  }
  function _r(t) {
    return ut(1, "showSnackbar", [JSON.stringify(typeof t == "string" ? { message: t } : t || {})]);
  }
  var br = new Map;
  function Wn(t) {
    let r = 2166136261;
    for (let n = 0;n < t.length; n++)
      r ^= t.charCodeAt(n), r = Math.imul(r, 16777619) >>> 0;
    return r;
  }
  function Se(t) {
    let r = br.get(t);
    return r !== undefined || (r = Wn(t), Ae(t), G(23, r, Ee, pe), br.set(t, r)), r;
  }
  function Bn(t, r) {
    G(4, t, Se(r), 0);
  }
  function Ot(t, r) {
    let n = t.get(r);
    return n === undefined && (n = new Map, t.set(r, n)), n;
  }
  function vr(t, r, n) {
    const l = Se(r), s = n >>> 0, f = Ot(fr, t);
    if (f.get(l) === s) {
      be++;
      return;
    }
    f.set(l, s), G(24, t, l, s), se++;
  }
  function Er(t, r, n) {
    const l = Se(r), s = Ot(dr, t);
    if (s.get(l) === n) {
      be++;
      return;
    }
    s.set(l, n), Ie[0] = n, G(25, t, l, Ge[0]), se++;
  }
  function pr(t, r, n) {
    const l = Se(r), s = n == null ? "" : String(n), f = Ot(gr, t);
    if (f.get(l) === s) {
      be++;
      return;
    }
    f.set(l, s), Ae(s);
    const w = Ee & 16777215, E = pe & 255;
    G(26, t, l, w << 8 | E), se++;
  }
  function Hn(t, r, n) {
    G(27, t, Se(r), n);
  }
  var Ue = new Map, fe = new Map, Sr = 1;
  function wr(t, r) {
    for (let n = 0;n < r.length; n++) {
      const l = r[n];
      if (typeof l == "number")
        Number.isInteger(l) ? G(29, t, 1, l | 0) : (Ie[0] = l, G(29, t, 2, Ge[0]));
      else if (typeof l == "boolean")
        G(29, t, 3, l ? 1 : 0);
      else if (typeof l == "string") {
        Ae(l);
        const s = Ee >>> 0;
        G(29, t, 4 | (pe & 16777215) << 8, s);
      } else
        G(29, t, 0, 0);
    }
  }
  function ut(t, r, n) {
    const l = Se(r), s = Sr++;
    return wr(s, n), G(28, t, l, s), B(), new Promise((f, w) => {
      Ue.set(s, { resolve: f, reject: w });
    });
  }
  function Mn(t, r, n, l, s) {
    const f = Se(r), w = Sr++;
    wr(w, n), G(30, t, f, w), B(), fe.set(w, { nodeId: t, onValue: l, onError: s && s.onError, onDone: s && s.onDone });
    let E = ke.get(t);
    return E === undefined && (E = new Set, ke.set(t, E)), E.add(w), function() {
      if (!fe.has(w))
        return;
      fe.delete(w);
      const C = ke.get(t);
      C && (C.delete(w), C.size === 0 && ke.delete(t)), G(31, w, 0, 0), B();
    };
  }
  function Gn(t) {
    const r = ke.get(t);
    if (r !== undefined) {
      for (const n of r)
        fe.has(n) && (fe.delete(n), G(31, n, 0, 0));
      ke.delete(t), B();
    }
  }
  var At = new Map, Un = 1;
  function yt(t) {
    const r = Un++;
    return At.set(r, t), r;
  }
  function Rr(t, r, n) {
    G(21, t, r, n);
  }
  var $t = 0n, we = null, mr = ir - mt, kt = mt >> 2, Xn = mt + mr >> 2, Yn = mr / 16 | 0, Pr = new ArrayBuffer(4), It = new Float32Array(Pr), Nt = new Uint32Array(Pr), Jn = new TextDecoder("utf-8");
  function Lt(t, r) {
    return r === 0 ? "" : Jn.decode(sr.subarray(Rt + t, Rt + t + r));
  }
  function Dt(t, r) {
    ne[hn] = t + r;
  }
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load(Pt, _n);
    if (t === $t)
      return;
    const r = kt + (ne[gn] >> 2);
    let n = kt + (ne[lr] >> 2);
    const l = Xn, s = kt;
    let f = Yn;
    for (;n !== r && f-- > 0; ) {
      const w = ne[n + 0], E = w & 255, A = w >>> 8 & 255, C = ne[n + 1], T = ne[n + 2], m = ne[n + 3];
      let $, F = false;
      if (A === 1)
        $ = T | 0, F = true;
      else if (A === 2)
        Nt[0] = T, $ = It[0], F = true;
      else if (A === 3)
        $ = T !== 0, F = true;
      else if (A === 4)
        $ = Lt(m, T), F = true, Dt(m, T);
      else if (A === 5) {
        const _ = Lt(m, T);
        try {
          $ = JSON.parse(_);
        } catch {
          $ = _;
        }
        F = true, Dt(m, T);
      } else if (A === 6) {
        const _ = Lt(m, T);
        try {
          $ = JSON.parse(_);
        } catch {
          $ = [];
        }
        F = true, Dt(m, T);
      } else if (A === 7) {
        Nt[0] = T;
        const _ = It[0];
        Nt[0] = m, $ = [_, It[0]], F = true;
      }
      if (E === 3) {
        const _ = Ue.get(C);
        if (_) {
          Ue.delete(C);
          try {
            _.resolve(F ? $ : undefined);
          } catch (b) {
            we = b && (b.stack || b.message || String(b)) || "unknown";
          }
        }
      } else if (E === 4) {
        const _ = Ue.get(C);
        if (_) {
          Ue.delete(C);
          try {
            const b = typeof $ == "string" ? $ : `skal RPC error (status ${$})`;
            _.reject(new Error(b));
          } catch (b) {
            we = b && (b.stack || b.message || String(b)) || "unknown";
          }
        }
      } else if (E === 5) {
        const _ = fe.get(C);
        if (_)
          try {
            _.onValue(F ? $ : undefined);
          } catch (b) {
            we = b && (b.stack || b.message || String(b)) || "unknown";
          }
      } else if (E === 6) {
        const _ = fe.get(C);
        if (_) {
          fe.delete(C);
          try {
            _.onDone && _.onDone();
          } catch (b) {
            we = b && (b.stack || b.message || String(b)) || "unknown";
          }
        }
      } else if (E === 7) {
        const _ = fe.get(C);
        if (_) {
          fe.delete(C);
          try {
            _.onError && _.onError(new Error(typeof $ == "string" ? $ : "skal stream error"));
          } catch (b) {
            we = b && (b.stack || b.message || String(b)) || "unknown";
          }
        }
      } else {
        const _ = At.get(C);
        if (_)
          try {
            F ? (A === 6 || A === 7) && Array.isArray($) ? _(...$) : _($) : _();
          } catch (b) {
            we = b && (b.stack || b.message || String(b)) || "unknown";
          }
      }
      n += 4, n >= l && (n = s);
    }
    ne[lr] = n - s << 2, $t = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: At.size, opSeq: Number(it), lastEventSeq: Number($t), lastHandlerError: we, propWrites: se, propSkips: be });
  var pl = 1, jn = 2;
  function Tr() {
    return jn++;
  }
  var qn = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24, animatedList: 25, crossFade: 26, hero: 27, listTile: 28, pageView: 29, dismissible: 30, customScrollView: 31, sliverAppBar: 32, sliverList: 33, sliverGrid: 34 }, Kn = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], leadingIcon: [98, "str"], subtitle: [73, "str"], trailingIcon: [99, "str"], activeTab: [137, "u32"], tag: [72, "str"], transition: [171, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"], draggable: [172, "u32"], spring: [173, "u32"], release: [174, "u32"], sliverMode: [175, "u32"] }, Qn = { opacity: On, translationX: An, translationY: yn, scaleX: $n, scaleY: kn, rotation: In }, Zn = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12, onDismiss: 20, onPanStart: 13, onPanUpdate: 14, onPanEnd: 15, onScaleStart: 16, onScaleUpdate: 17, onScaleEnd: 18 }, ei = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, ti = { gentle: 1, bouncy: 2, stiff: 3 };
  function ri(t) {
    if (typeof t == "number")
      return t | 0;
    if (typeof t != "string")
      return 0;
    let r = t.trim();
    r.startsWith("#") && (r = r.slice(1));
    let n = 0, l = 0, s = 0, f = 255;
    return r.length === 3 ? (n = parseInt(r[0] + r[0], 16), l = parseInt(r[1] + r[1], 16), s = parseInt(r[2] + r[2], 16)) : r.length === 4 ? (n = parseInt(r[0] + r[0], 16), l = parseInt(r[1] + r[1], 16), s = parseInt(r[2] + r[2], 16), f = parseInt(r[3] + r[3], 16)) : r.length === 6 ? (n = parseInt(r.slice(0, 2), 16), l = parseInt(r.slice(2, 4), 16), s = parseInt(r.slice(4, 6), 16)) : r.length === 8 && (f = parseInt(r.slice(0, 2), 16), n = parseInt(r.slice(2, 4), 16), l = parseInt(r.slice(4, 6), 16), s = parseInt(r.slice(6, 8), 16)), (f & 255) << 24 | (n & 255) << 16 | (l & 255) << 8 | s & 255 | 0;
  }
  function ni(t) {
    return typeof t == "number" ? t | 0 : t === "fill" ? vn : t === "wrap" ? En : -1;
  }
  function ii(t) {
    if (Array.isArray(t))
      return true;
    const r = Object.getPrototypeOf(t);
    return r === Object.prototype || r === null;
  }
  function oi(t, r, n) {
    if (n == null)
      return;
    if (r === "ref" && n && typeof n.__skalBind == "function") {
      n.__skalBind(t.id);
      return;
    }
    const l = typeof n;
    if (l === "object" && ii(n)) {
      pr(t.id, r, JSON.stringify(n)), B();
      return;
    }
    if (l === "function") {
      const s = yt(n);
      Hn(t.id, r, s), B();
      return;
    }
    if (l === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 && vr(t.id, r, n | 0), Er(t.id, r, n), B();
      return;
    }
    if (l === "string") {
      pr(t.id, r, n), B();
      return;
    }
    if (l === "boolean") {
      vr(t.id, r, n ? 1 : 0), B();
      return;
    }
  }
  function ai(t) {
    const r = [t];
    for (;r.length > 0; ) {
      const n = r.pop();
      xn(n.id);
      let l = n.firstChild;
      for (;l; )
        r.push(l), l = l.nextSibling;
    }
  }
  var ft = class {
    constructor(t, r, n = false, l = false) {
      this.tag = t, this.id = r, this.isText = n, this.isCustom = l, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, li = Qr({ createElement(t) {
    const r = Tr(), n = qn[t];
    return n !== undefined ? (G(1, r, n, 0), B(), new ft(t, r, false, false)) : (Bn(r, t), B(), new ft(t, r, false, true));
  }, createTextNode(t) {
    const r = Tr();
    G(1, r, 3, 0);
    const n = t == null ? "" : String(t);
    n.length > 0 && xt(r, n), B();
    const l = new ft("#text", r, true);
    return l.text = n, l;
  }, replaceText(t, r) {
    const n = r == null ? "" : String(r);
    t.text !== n && (t.text = n, xt(t.id, n), B());
  }, setProperty(t, r, n, l) {
    if (t.isCustom) {
      oi(t, r, n);
      return;
    }
    if (r === "onRefresh") {
      if (typeof n == "function") {
        const E = t.id, A = n, T = yt(async () => {
          try {
            await A();
          } finally {
            zn(E);
          }
        });
        Rr(t.id, 19, T), B();
      }
      return;
    }
    const s = Zn[r];
    if (s !== undefined) {
      if (typeof n == "function") {
        const E = yt(n);
        Rr(t.id, s, E), B();
      }
      return;
    }
    if (r === "value" && t.tag === "slider") {
      hr(t.id, 133, Number(n) || 0), B();
      return;
    }
    if (r === "draggable" && typeof n == "string") {
      re(t.id, 172, { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }[n] ?? 0), B();
      return;
    }
    if (r === "spring" && typeof n == "string") {
      re(t.id, 173, { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }[n] ?? 0), B();
      return;
    }
    if (r === "release" && typeof n == "string") {
      re(t.id, 174, { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }[n.toLowerCase()] ?? 0), B();
      return;
    }
    if (r === "sliverMode" && typeof n == "string") {
      re(t.id, 175, { normal: 0, pinned: 1, floating: 2, both: 3 }[n.toLowerCase()] ?? 0), B();
      return;
    }
    if (r === "animate" && n && typeof n == "object") {
      if (re(t.id, 163, n.duration | 0), n.curve != null) {
        const E = typeof n.curve == "string" ? ei[n.curve] ?? 0 : n.curve | 0;
        re(t.id, 164, E);
      }
      if (n.delay != null && re(t.id, 165, n.delay | 0), n.repeat != null && re(t.id, 167, n.repeat ? 1 : 0), n.reverse != null && re(t.id, 168, n.reverse ? 1 : 0), n.loop != null && re(t.id, 169, n.loop | 0), n.spring != null) {
        const E = typeof n.spring == "string" ? ti[n.spring] ?? 0 : n.spring ? 2 : 0;
        re(t.id, 170, E);
      }
      B();
      return;
    }
    if (r === "label" && (t.tag === "button" || t.tag === "text")) {
      const E = n == null ? "" : String(n);
      xt(t.id, E), B();
      return;
    }
    const f = Qn[r];
    if (f !== undefined) {
      typeof n == "number" && (f(t.id, n), B());
      return;
    }
    const w = Kn[r];
    if (w !== undefined) {
      const [E, A] = w;
      if (n == null)
        return;
      switch (A) {
        case "u32":
          typeof n == "number" ? (re(t.id, E, n | 0), B()) : typeof n == "boolean" && (re(t.id, E, n ? 1 : 0), B());
          return;
        case "f32":
          typeof n == "number" && (hr(t.id, E, n), B());
          return;
        case "str":
          Cn(t.id, E, String(n)), B();
          return;
        case "color":
          re(t.id, E, ri(n)), B();
          return;
        case "dim":
          re(t.id, E, ni(n)), B();
          return;
      }
      return;
    }
    if (r === "style" && n && typeof n == "object") {
      for (const E in n)
        this.setProperty(t, E, n[E]);
      return;
    }
  }, insertNode(t, r, n) {
    if (r === n)
      return;
    if (r.parent) {
      const s = r.parent;
      r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : s.firstChild === r && (s.firstChild = r.nextSibling), r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : s.lastChild === r && (s.lastChild = r.prevSibling), r.prevSibling = null, r.nextSibling = null;
    }
    const l = n ? n.id : 0;
    G(3, t.id, r.id, l), B(), r.parent = t, n ? (r.nextSibling = n, r.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = r : t.firstChild = r, n.prevSibling = r) : (r.prevSibling = t.lastChild, r.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = r : t.firstChild = r, t.lastChild = r);
  }, removeNode(t, r) {
    G(2, r.id, 0, 0), ai(r), B(), r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : t.firstChild = r.nextSibling, r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : t.lastChild = r.prevSibling, r.parent = null, r.prevSibling = null, r.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: si, effect: z, memo: zt, createComponent: k, createElement: o, createTextNode: Sl, insertNode: d, insert: L, spread: wl, setProp: e, mergeProps: Rl, use: ci } = li;
  G(1, 1, 0, 0), B();
  var ui = new ft("box", 1, false);
  function fi() {
    let t = 0;
    const r = function() {};
    return r.__skalBind = (n) => {
      t = n;
    }, new Proxy(r, { apply(n, l, s) {
      const f = s[0];
      f && typeof f.id == "number" && (t = f.id);
    }, get(n, l) {
      if (l === "__skalBind" || typeof l == "symbol")
        return r[l];
      if (typeof l == "string" && l.endsWith("$") && l.length > 1) {
        const s = l.slice(0, -1);
        return (...f) => {
          if (t === 0)
            throw new Error(`skal ref: cannot call .${String(l)}() before the host mounts. Move the call into a JSX event handler.`);
          const w = f[f.length - 1];
          if (typeof w != "function")
            throw new TypeError(`skal ref: .${String(l)}() requires a callback as its last argument (got ${typeof w})`);
          const E = f.slice(0, -1);
          return Mn(t, s, E, w);
        };
      }
      return (...s) => t === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(l)}() before the host mounts. Move the call into a JSX event handler.`)) : ut(t, l, s);
    } });
  }
  function Vt(t, r, n) {
    const l = (_) => {
      const b = t[_];
      return typeof b == "function" ? b : b && b.component || null;
    }, s = (_) => {
      const b = t[_];
      return b && typeof b == "object" ? b.title : undefined;
    }, f = (_) => {
      const b = t[_];
      return b && typeof b == "object" ? b.transition : undefined;
    }, w = (_) => _ === "fade" ? 1 : _ === "none" ? 2 : typeof _ == "number" ? _ : 0, E = !!(n && n.linking), A = typeof window < "u", C = () => {
      if (!A)
        return null;
      const _ = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
      return _ && t[_] ? _ : null;
    };
    let T = typeof r == "string" ? r : r && r.name || Object.keys(t)[0];
    if (E) {
      const _ = C();
      _ && (T = _);
    }
    const [m, $] = V([{ name: T, params: {}, title: s(T), transition: f(T) }]), F = { stack: m, navigate(_, b, y) {
      $([...m(), { name: _, params: b || {}, presentation: y && y.presentation, title: (y && y.title) !== undefined ? y.title : s(_), transition: (y && y.transition) !== undefined ? y.transition : f(_) }]);
    }, back() {
      const _ = m();
      _.length > 1 && $(_.slice(0, -1));
    }, replace(_, b, y) {
      $([...m().slice(0, -1), { name: _, params: b || {}, title: (y && y.title) !== undefined ? y.title : s(_), transition: (y && y.transition) !== undefined ? y.transition : f(_) }]);
    }, reset(_, b) {
      $([{ name: _, params: b || {}, title: s(_), transition: f(_) }]);
    }, canGoBack() {
      return m().length > 1;
    } };
    return E && A && Dr(() => {
      const _ = m(), b = "#/" + _[_.length - 1].name;
      window.location.hash !== b && window.history.replaceState({}, "", b);
    }), F.View = () => (() => {
      var _ = o("navigator");
      return e(_, "onPop", () => F.back()), L(_, k(ie, { get each() {
        return m();
      }, children: (b) => {
        const y = l(b.name);
        return (() => {
          var D = o("screen");
          return L(D, y ? k(y, { get params() {
            return b.params || {};
          }, router: F }) : null), z((p) => {
            var v = b.presentation === "modal" ? 1 : 0, a = b.title || "", u = w(b.transition);
            return v !== p.e && (p.e = e(D, "presentation", v, p.e)), a !== p.t && (p.t = e(D, "title", a, p.t)), u !== p.a && (p.a = e(D, "transition", u, p.a)), p;
          }, { e: undefined, t: undefined, a: undefined }), D;
        })();
      } })), _;
    })(), F;
  }
  var Le = "#FF0A84FF", Xe = "#FF34C759", Ye = "#FFFF9F0A", Wt = "#FFFF3B30", dt = "#FF5E5CE6";
  function W(t) {
    return (() => {
      var r = o("column"), n = o("text");
      return d(r, n), e(r, "background", "#FFFFFFFF"), e(r, "cornerRadius", 14), e(r, "padding", 16), e(r, "gap", 12), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(n, "fontSize", 15), e(n, "fontWeight", 800), e(n, "color", "#FF1C1C1E"), L(r, () => t.children, null), z((l) => e(n, "label", t.title, l)), r;
    })();
  }
  function di(t) {
    const r = ["Inbox", "Starred", "Drafts", "Archive"];
    return (() => {
      var n = o("column");
      return e(n, "background", "#FFF2F2F7"), e(n, "padding", 16), e(n, "gap", 8), e(n, "height", "fill"), L(n, k(ie, { each: r, children: (l) => (() => {
        var s = o("box"), f = o("text");
        return d(s, f), e(s, "background", "#FFFFFFFF"), e(s, "cornerRadius", 8), e(s, "padding", 12), e(s, "onTap", () => t.router.navigate("detail", { name: l }, { title: l })), e(f, "label", `${l}   \u203A`), e(f, "fontSize", 14), e(f, "color", "#FF1C1C1E"), s;
      })() })), n;
    })();
  }
  function gi(t) {
    return (() => {
      var r = o("column"), n = o("text"), l = o("text");
      return d(r, n), d(r, l), e(r, "background", "#FFF2F2F7"), e(r, "padding", 16), e(r, "gap", 10), e(r, "height", "fill"), e(n, "fontSize", 20), e(n, "fontWeight", 800), e(n, "color", "#FF1C1C1E"), e(l, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), e(l, "fontSize", 13), e(l, "color", "#FF8E8E93"), z((s) => e(n, "label", t.name, s)), r;
    })();
  }
  var hi = [Le, Xe, Ye, dt];
  function Fi() {
    const [t, r] = V(false), [n, l] = V(false), [s, f] = V(false), [w, E] = V(0), [A, C] = V("0, 0"), [T, m] = V(false), [$, F] = V(["Alpha", "Beta", "Gamma"]);
    let _ = 3;
    const b = Vt({ gallery: (y) => (() => {
      var D = o("column"), p = o("text"), v = o("row");
      return d(D, p), d(D, v), e(D, "background", "#FFF2F2F7"), e(D, "padding", 16), e(D, "gap", 12), e(D, "height", "fill"), e(p, "label", "Tap a swatch \u2014 it flies to the detail screen."), e(p, "fontSize", 13), e(p, "color", "#FF8E8E93"), e(v, "gap", 12), L(v, k(ie, { each: hi, children: (a) => (() => {
        var u = o("hero"), g = o("box");
        return d(u, g), e(u, "tag", `hero-${a}`), e(g, "width", 56), e(g, "height", 56), e(g, "background", a), e(g, "cornerRadius", 12), e(g, "onTap", () => y.router.navigate("detail", { color: a })), u;
      })() })), D;
    })(), detail: { component: (y) => (() => {
      var D = o("column"), p = o("hero"), v = o("box"), a = o("text");
      return d(D, p), d(D, a), e(D, "background", "#FFF2F2F7"), e(D, "padding", 16), e(D, "gap", 12), e(D, "height", "fill"), d(p, v), e(v, "width", "fill"), e(v, "height", 180), e(v, "cornerRadius", 20), e(a, "label", "The swatch flew here from the gallery \u2014 a shared-element transition, GPU-composited host-side."), e(a, "fontSize", 13), e(a, "color", "#FF8E8E93"), z((u) => {
        var g = `hero-${y.params.color}`, R = y.params.color;
        return g !== u.e && (u.e = e(p, "tag", g, u.e)), R !== u.t && (u.t = e(v, "background", R, u.t)), u;
      }, { e: undefined, t: undefined }), D;
    })(), title: "Detail", transition: "fade" } }, "gallery");
    return (() => {
      var y = o("scrollView"), D = o("text"), p = o("text"), v = o("text");
      return d(y, D), d(y, p), d(y, v), e(y, "background", "#FFF2F2F7"), e(y, "padding", 16), e(y, "gap", 14), e(D, "label", "Animations"), e(D, "fontSize", 24), e(D, "fontWeight", 800), e(D, "color", "#FF1C1C1E"), e(p, "label", "Host-side motion \u2014 JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."), e(p, "fontSize", 13), e(p, "color", "#FF8E8E93"), L(y, k(W, { title: "Implicit hot-prop tween \u2014 the animate prop", get children() {
        return [(() => {
          var a = o("row"), u = o("box");
          return d(a, u), e(a, "gap", 8), e(u, "width", 64), e(u, "height", 64), e(u, "background", "#FF0A84FF"), e(u, "cornerRadius", 14), e(u, "animate", { duration: 450, curve: "easeInOut" }), z((g) => {
            var R = t() ? 0.3 : 1, P = t() ? 1.4 : 1, I = t() ? 1.4 : 1, Z = t() ? 0.5 : 0, J = t() ? 70 : 0;
            return R !== g.e && (g.e = e(u, "opacity", R, g.e)), P !== g.t && (g.t = e(u, "scaleX", P, g.t)), I !== g.a && (g.a = e(u, "scaleY", I, g.a)), Z !== g.o && (g.o = e(u, "rotation", Z, g.o)), J !== g.i && (g.i = e(u, "translationX", J, g.i)), g;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => r(!t())), z((u) => e(a, "label", t() ? "Reset" : "Animate", u)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), v), L(y, k(W, { title: "Cold-prop tween \u2014 colour \xB7 radius \xB7 padding", get children() {
        return [(() => {
          var a = o("box"), u = o("text");
          return d(a, u), e(a, "animate", { duration: 400, curve: "easeInOut" }), e(a, "width", "fill"), e(u, "label", "AnimatedContainer tweens these host-side"), e(u, "fontSize", 12), e(u, "color", "#FFFFFFFF"), z((g) => {
            var R = n() ? Wt : Le, P = n() ? 32 : 8, I = n() ? 28 : 12;
            return R !== g.e && (g.e = e(a, "background", R, g.e)), P !== g.t && (g.t = e(a, "cornerRadius", P, g.t)), I !== g.a && (g.a = e(a, "padding", I, g.a)), g;
          }, { e: undefined, t: undefined, a: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => l(!n())), z((u) => e(a, "label", n() ? "Reset" : "Animate", u)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "background, cornerRadius and padding are cold props \u2014 the host's AnimatedContainer tweens them; JS writes each value once."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), v), L(y, k(W, { title: "Looping \u2014 repeat \xB7 reverse", get children() {
        return [(() => {
          var a = o("row"), u = o("box"), g = o("box"), R = o("box");
          return d(a, u), d(a, g), d(a, R), e(a, "gap", 20), e(u, "width", 44), e(u, "height", 44), e(u, "background", "#FF5E5CE6"), e(u, "cornerRadius", 22), e(u, "animate", { duration: 800, curve: "easeInOut", repeat: true, reverse: true }), e(u, "scaleX", 1.35), e(u, "scaleY", 1.35), e(g, "width", 44), e(g, "height", 44), e(g, "background", "#FF34C759"), e(g, "cornerRadius", 10), e(g, "animate", { duration: 1400, repeat: true }), e(g, "rotation", 6.2832), e(R, "width", 44), e(R, "height", 44), e(R, "background", "#FFFF9F0A"), e(R, "cornerRadius", 22), e(R, "animate", { duration: 900, curve: "easeInOut", repeat: true, reverse: true }), e(R, "opacity", 0.25), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "A pulse, a spin and a breathe \u2014 each loops forever host-side; JS set the endpoints once and never touches them again."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), v), L(y, k(W, { title: "Spring physics \u2014 animate.spring", get children() {
        return [(() => {
          var a = o("column"), u = o("box"), g = o("box"), R = o("box");
          return d(a, u), d(a, g), d(a, R), e(a, "gap", 10), e(u, "width", 48), e(u, "height", 48), e(u, "background", "#FF0A84FF"), e(u, "cornerRadius", 10), e(u, "animate", { duration: 700, spring: "gentle" }), e(g, "width", 48), e(g, "height", 48), e(g, "background", "#FF34C759"), e(g, "cornerRadius", 10), e(g, "animate", { duration: 700, spring: "bouncy" }), e(R, "width", 48), e(R, "height", 48), e(R, "background", "#FFFF9F0A"), e(R, "cornerRadius", 10), e(R, "animate", { duration: 700, spring: "stiff" }), z((P) => {
            var I = s() ? 150 : 0, Z = s() ? 150 : 0, J = s() ? 150 : 0;
            return I !== P.e && (P.e = e(u, "translationX", I, P.e)), Z !== P.t && (P.t = e(g, "translationX", Z, P.t)), J !== P.a && (P.a = e(R, "translationX", J, P.a)), P;
          }, { e: undefined, t: undefined, a: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => f(!s())), z((u) => e(a, "label", s() ? "Back" : "Spring", u)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "gentle \xB7 bouncy \xB7 stiff \u2014 three spring-like curves; bouncy overshoots and wobbles into place."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), v), L(y, k(W, { title: "Physics \u2014 real SpringSimulation (spring)", get children() {
        return [(() => {
          var a = o("column"), u = o("box"), g = o("box"), R = o("box");
          return d(a, u), d(a, g), d(a, R), e(a, "gap", 12), e(u, "width", 52), e(u, "height", 52), e(u, "background", "#FF0A84FF"), e(u, "cornerRadius", 12), e(u, "spring", "gentle"), e(g, "width", 52), e(g, "height", 52), e(g, "background", "#FF34C759"), e(g, "cornerRadius", 12), e(g, "spring", "bouncy"), e(R, "width", 52), e(R, "height", 52), e(R, "background", "#FFFF9F0A"), e(R, "cornerRadius", 12), e(R, "spring", "stiff"), z((P) => {
            var I = w(), Z = w(), J = w();
            return I !== P.e && (P.e = e(u, "translationX", I, P.e)), Z !== P.t && (P.t = e(g, "translationX", Z, P.t)), J !== P.a && (P.a = e(R, "translationX", J, P.a)), P;
          }, { e: undefined, t: undefined, a: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => E(w() === 0 ? 175 : 0)), z((u) => e(a, "label", w() === 0 ? "Spring" : "Back", u)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "A real SpringSimulation drives these \u2014 not a curve. Tap fast: the box retargets from its CURRENT position and velocity mid-flight, with no dead-stop restart. gentle settles, bouncy overshoots, stiff snaps."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), v), L(y, k(W, { title: "Physics \u2014 release momentum (draggable + release)", get children() {
        return [(() => {
          var a = o("box"), u = o("box"), g = o("text");
          return d(a, u), e(a, "height", 150), e(a, "background", "#FFEFEFF4"), e(a, "cornerRadius", 12), d(u, g), e(u, "draggable", true), e(u, "release", "glide"), e(u, "width", 60), e(u, "height", 60), e(u, "background", "#FF0A84FF"), e(u, "cornerRadius", 14), e(u, "onPanEnd", (R, P) => C(`${R.toFixed(0)}, ${P.toFixed(0)}`)), e(g, "label", "glide"), e(g, "fontSize", 11), e(g, "color", "#FFFFFFFF"), a;
        })(), (() => {
          var a = o("text");
          return e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), z((u) => e(a, "label", `Throw the blue box \u2014 friction carries it on after you let go and decelerates it to rest. Resting at ${A()}.`, u)), a;
        })(), (() => {
          var a = o("box"), u = o("box"), g = o("text");
          return d(a, u), e(a, "height", 150), e(a, "background", "#FFEFEFF4"), e(a, "cornerRadius", 12), d(u, g), e(u, "draggable", true), e(u, "release", "springBack"), e(u, "width", 60), e(u, "height", 60), e(u, "background", "#FF5E5CE6"), e(u, "cornerRadius", 14), e(g, "label", "spring"), e(g, "fontSize", 11), e(g, "color", "#FFFFFFFF"), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "Throw the purple box \u2014 a SpringSimulation springs it home to the origin, seeded with your fling velocity (throw harder \u2192 springs back harder). All host-side: zero per-frame bridge traffic."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), v), L(y, k(W, { title: "Cross-fade \u2014 CrossFade", get children() {
        return [(() => {
          var a = o("box"), u = o("crossFade");
          return d(a, u), e(a, "height", 92), L(u, (() => {
            var g = zt(() => !!T());
            return () => g() ? (() => {
              var R = o("box"), P = o("text");
              return d(R, P), e(R, "width", "fill"), e(R, "height", 92), e(R, "background", "#FF5E5CE6"), e(R, "cornerRadius", 12), e(R, "padding", 16), e(P, "label", "Panel B"), e(P, "fontSize", 16), e(P, "fontWeight", 800), e(P, "color", "#FFFFFFFF"), R;
            })() : (() => {
              var R = o("box"), P = o("text");
              return d(R, P), e(R, "width", "fill"), e(R, "height", 92), e(R, "background", "#FF0A84FF"), e(R, "cornerRadius", 12), e(R, "padding", 16), e(P, "label", "Panel A"), e(P, "fontSize", 16), e(P, "fontWeight", 800), e(P, "color", "#FFFFFFFF"), R;
            })();
          })()), a;
        })(), (() => {
          var a = o("button");
          return e(a, "label", "Swap panel"), e(a, "onClick", () => m(!T())), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "AnimatedSwitcher fades the old child out as the new fades in \u2014 the outgoing element is retained through the fade."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), v), L(y, k(W, { title: "Animated list \u2014 AnimatedList", get children() {
        return [(() => {
          var a = o("animatedList");
          return e(a, "gap", 8), L(a, k(ie, { get each() {
            return $();
          }, children: (u) => (() => {
            var g = o("box"), R = o("text");
            return d(g, R), e(g, "background", "#FFEFEFF4"), e(g, "cornerRadius", 8), e(g, "padding", 12), e(R, "label", u), e(R, "fontSize", 13), e(R, "color", "#FF1C1C1E"), g;
          })() })), a;
        })(), (() => {
          var a = o("row"), u = o("button"), g = o("button");
          return d(a, u), d(a, g), e(a, "gap", 8), e(u, "label", "Add"), e(u, "onClick", () => F([...$(), `Item ${++_}`])), e(g, "label", "Remove"), e(g, "onClick", () => F($().slice(0, -1))), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "Add \u2192 a row fades + expands in; Remove \u2192 it collapses + fades out. Both host-side, via deferred teardown."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), v), L(y, k(W, { title: "Shared element \u2014 Hero", get children() {
        return [(() => {
          var a = o("box");
          return e(a, "height", 300), e(a, "borderWidth", 1), e(a, "borderColor", "#FFE5E5EA"), e(a, "cornerRadius", 8), L(a, k(b.View, {})), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "A Hero with a matching tag on each screen flies between them across the navigator push \u2014 the navigator is a real Flutter Navigator."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), v), e(v, "label", "\u2014 end of animations \u2014"), e(v, "fontSize", 12), e(v, "color", "#FF8E8E93"), y;
    })();
  }
  function _i() {
    const [t, r] = V("material"), [n, l] = V(false), [s, f] = V(true), [w, E] = V(false), [A, C] = V(40), [T, m] = V(""), [$, F] = V("none yet"), [_, b] = V(0), [y, D] = V(["Item one", "Item two", "Item three", "Item four"]);
    let p = 0;
    const [v, a] = V("0, 0"), [u, g] = V("\u2014"), [R, P] = V(1);
    let I = 1;
    const [Z, J] = V("\u2014 try a dialog button \u2014"), [ae, ge] = V(["First item", "Second item", "Third item", "Fourth item"]), Je = Vt({ list: { component: (ce) => k(di, { get router() {
      return ce.router;
    } }), title: "Mailboxes" }, detail: (ce) => k(gi, { get name() {
      return ce.params.name;
    }, get router() {
      return ce.router;
    } }) }, "list"), [je, Bt] = V(0), Ht = (ce, U) => {
      r(ce), l(U), Dn(ce, U ? 1 : 0);
    }, Pi = Vt({ home: { component: (ce) => Ti(ce.router) }, animations: { component: () => k(Fi, {}), title: "Animations" } }, "home");
    function Ti(ce) {
      return (() => {
        var U = o("scrollView"), qe = o("text"), gt = o("text"), Y = o("text");
        return d(U, qe), d(U, gt), d(U, Y), e(U, "background", "#FFF2F2F7"), e(U, "padding", 16), e(U, "gap", 14), e(qe, "label", "Skal \u2014 Component Demo"), e(qe, "fontSize", 24), e(qe, "fontWeight", 800), e(qe, "color", "#FF1C1C1E"), e(gt, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), e(gt, "fontSize", 13), e(gt, "color", "#FF8E8E93"), L(U, k(W, { title: "Design system \u2014 setDesign()", get children() {
          return [(() => {
            var i = o("text");
            return e(i, "fontSize", 13), e(i, "color", "#FF8E8E93"), z((c) => e(i, "label", `active: ${t()} \xB7 ${n() ? "dark" : "light"}`, c)), i;
          })(), (() => {
            var i = o("row"), c = o("button"), h = o("button"), S = o("button");
            return d(i, c), d(i, h), d(i, S), e(i, "gap", 8), e(c, "label", "Material"), e(c, "onClick", () => Ht("material", n())), e(h, "label", "Cupertino"), e(h, "onClick", () => Ht("cupertino", n())), e(S, "onClick", () => Ht(t(), !n())), z((N) => e(S, "label", n() ? "Light mode" : "Dark mode", N)), i;
          })(), (() => {
            var i = o("text");
            return e(i, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), Y), L(U, k(W, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
          return [(() => {
            var i = o("row"), c = o("box"), h = o("box"), S = o("box");
            return d(i, c), d(i, h), d(i, S), e(i, "gap", 8), e(c, "width", 56), e(c, "height", 56), e(c, "background", "#FF0A84FF"), e(c, "cornerRadius", 10), e(h, "width", 56), e(h, "height", 56), e(h, "background", "#FF34C759"), e(h, "cornerRadius", 10), e(S, "width", 56), e(S, "height", 56), e(S, "background", "#FFFF9F0A"), e(S, "cornerRadius", 10), i;
          })(), (() => {
            var i = o("text");
            return e(i, "label", "Wrap \u2014 children flow onto new runs:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = o("wrap");
            return e(i, "gap", 6), L(i, k(ie, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (c) => (() => {
              var h = o("box"), S = o("text");
              return d(h, S), e(h, "background", "#FFEFEFF4"), e(h, "cornerRadius", 12), e(h, "paddingLeft", 10), e(h, "paddingRight", 10), e(h, "paddingTop", 6), e(h, "paddingBottom", 6), e(S, "label", c), e(S, "fontSize", 12), e(S, "color", "#FF1C1C1E"), h;
            })() })), i;
          })()];
        } }), Y), L(U, k(W, { title: "Stack \u2014 overlap + positioned children", get children() {
          var i = o("stack"), c = o("box"), h = o("box"), S = o("text"), N = o("box");
          return d(i, c), d(i, h), d(i, N), e(i, "width", "fill"), e(i, "height", 120), e(c, "width", "fill"), e(c, "height", 120), e(c, "background", "#FF5E5CE6"), e(c, "cornerRadius", 12), d(h, S), e(h, "top", 10), e(h, "left", 10), e(h, "background", "#FFFFFFFF"), e(h, "cornerRadius", 8), e(h, "paddingLeft", 10), e(h, "paddingRight", 10), e(h, "paddingTop", 4), e(h, "paddingBottom", 4), e(S, "label", "top \xB7 left"), e(S, "fontSize", 11), e(S, "color", "#FF1C1C1E"), e(N, "bottom", 10), e(N, "right", 10), e(N, "width", 30), e(N, "height", 30), e(N, "background", "#FFFF3B30"), e(N, "cornerRadius", 15), i;
        } }), Y), L(U, k(W, { title: "Text & RichText", get children() {
          return [(() => {
            var i = o("text");
            return e(i, "label", "Styled text \u2014 18sp, weight 700."), e(i, "fontSize", 18), e(i, "fontWeight", 700), e(i, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = o("richText"), c = o("text"), h = o("text"), S = o("text"), N = o("text"), H = o("text");
            return d(i, c), d(i, h), d(i, S), d(i, N), d(i, H), e(c, "label", "Rich text "), e(c, "fontSize", 16), e(c, "color", "#FF1C1C1E"), e(h, "label", "mixes "), e(h, "fontSize", 16), e(h, "color", "#FF0A84FF"), e(h, "fontWeight", 800), e(S, "label", "size, "), e(S, "fontSize", 22), e(S, "color", "#FFFF3B30"), e(S, "fontWeight", 700), e(N, "label", "weight "), e(N, "fontSize", 16), e(N, "color", "#FF34C759"), e(N, "fontWeight", 800), e(H, "label", "and colour inline."), e(H, "fontSize", 16), e(H, "color", "#FF1C1C1E"), i;
          })()];
        } }), Y), L(U, k(W, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
          return [(() => {
            var i = o("image");
            return e(i, "src", "https://picsum.photos/seed/skal/640/360"), e(i, "width", "fill"), e(i, "height", 160), e(i, "contentScale", 1), e(i, "cornerRadius", 12), i;
          })(), (() => {
            var i = o("text");
            return e(i, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), Y), L(U, k(W, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
          return [(() => {
            var i = o("text");
            return e(i, "label", "listView axis=1 (horizontal, virtualized):"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = o("listView");
            return e(i, "axis", 1), e(i, "height", 66), e(i, "gap", 8), L(i, k(ie, { each: [Le, Xe, Ye, dt, Wt, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (c) => (() => {
              var h = o("box");
              return e(h, "width", 66), e(h, "height", 50), e(h, "background", c), e(h, "cornerRadius", 10), h;
            })() })), i;
          })(), (() => {
            var i = o("text");
            return e(i, "label", "lazyGrid \u2014 crossAxisCount=4:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = o("lazyGrid");
            return e(i, "crossAxisCount", 4), e(i, "aspectRatio", 1), e(i, "gap", 8), e(i, "height", 150), L(i, k(ie, { get each() {
              return Array.from({ length: 12 }, (c, h) => h);
            }, children: (c) => (() => {
              var h = o("box");
              return e(h, "background", c % 3 === 0 ? Le : c % 3 === 1 ? Xe : Ye), e(h, "cornerRadius", 8), h;
            })() })), i;
          })(), (() => {
            var i = o("text");
            return e(i, "label", "reorderableListView \u2014 drag a row to reorder:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = o("reorderableListView");
            return e(i, "height", 200), e(i, "gap", 6), e(i, "onReorder", (c, h) => {
              const S = ae().slice(), [N] = S.splice(c, 1);
              S.splice(h, 0, N), ge(S);
            }), L(i, k(ie, { get each() {
              return ae();
            }, children: (c) => (() => {
              var h = o("box"), S = o("text");
              return d(h, S), e(h, "background", "#FFEFEFF4"), e(h, "cornerRadius", 8), e(h, "padding", 12), e(S, "label", c), e(S, "fontSize", 13), e(S, "color", "#FF1C1C1E"), h;
            })() })), i;
          })()];
        } }), Y), L(U, k(W, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
          return [(() => {
            var i = o("row"), c = o("switch"), h = o("text");
            return d(i, c), d(i, h), e(i, "gap", 12), e(c, "onChange", (S) => f(S)), e(h, "fontSize", 13), e(h, "color", "#FF1C1C1E"), z((S) => {
              var N = s(), H = s() ? "switch: on" : "switch: off";
              return N !== S.e && (S.e = e(c, "checked", N, S.e)), H !== S.t && (S.t = e(h, "label", H, S.t)), S;
            }, { e: undefined, t: undefined }), i;
          })(), (() => {
            var i = o("row"), c = o("checkbox"), h = o("text");
            return d(i, c), d(i, h), e(i, "gap", 12), e(c, "onChange", (S) => E(S)), e(h, "fontSize", 13), e(h, "color", "#FF1C1C1E"), z((S) => {
              var N = w(), H = w() ? "checkbox: checked" : "checkbox: unchecked";
              return N !== S.e && (S.e = e(c, "checked", N, S.e)), H !== S.t && (S.t = e(h, "label", H, S.t)), S;
            }, { e: undefined, t: undefined }), i;
          })(), (() => {
            var i = o("slider");
            return e(i, "min", 0), e(i, "max", 100), e(i, "onChange", (c) => C(c)), z((c) => e(i, "value", A(), c)), i;
          })(), (() => {
            var i = o("text");
            return e(i, "fontSize", 13), e(i, "color", "#FF1C1C1E"), z((c) => e(i, "label", `slider: ${Math.round(A())}`, c)), i;
          })(), (() => {
            var i = o("textInput");
            return e(i, "placeholder", "Type your name\u2026"), e(i, "onChange", (c) => m(c)), e(i, "onSubmit", (c) => _r(`Submitted: ${c}`)), z((c) => e(i, "value", T(), c)), i;
          })(), (() => {
            var i = o("text");
            return e(i, "fontSize", 13), e(i, "color", "#FF8E8E93"), z((c) => e(i, "label", T() ? `Hello, ${T()}!` : "\u2014 type above; press Enter to submit \u2014", c)), i;
          })()];
        } }), Y), L(U, k(W, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
          return [(() => {
            var i = o("row"), c = o("activityIndicator"), h = o("text");
            return d(i, c), d(i, h), e(i, "gap", 12), e(c, "color", "#FF0A84FF"), e(h, "label", "CircularProgressIndicator"), e(h, "fontSize", 13), e(h, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = o("text");
            return e(i, "label", "determinate \u2014 tracks the slider above:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = o("progressBar");
            return e(i, "color", "#FF0A84FF"), z((c) => e(i, "progress", A() / 100, c)), i;
          })(), (() => {
            var i = o("text");
            return e(i, "label", "indeterminate:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = o("progressBar");
            return e(i, "color", "#FF34C759"), i;
          })()];
        } }), Y), L(U, k(W, { title: "Animation", get children() {
          return [(() => {
            var i = o("text");
            return e(i, "label", "Implicit tweens, looping, list enter/exit, Hero \u2014 all host-side, zero per-frame bridge traffic. Opens a dedicated page."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = o("button");
            return e(i, "label", "Open Animations \u2192"), e(i, "onClick", () => ce.navigate("animations")), i;
          })()];
        } }), Y), L(U, k(W, { title: "ListTile \u2014 structured rows", get children() {
          return [(() => {
            var i = o("box"), c = o("column"), h = o("listTile"), S = o("listTile"), N = o("listTile");
            return d(i, c), e(i, "background", "#FFFFFFFF"), e(i, "cornerRadius", 12), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), d(c, h), d(c, S), d(c, N), e(c, "padding", 0), e(c, "gap", 0), e(h, "leadingIcon", "person"), e(h, "title", "Profile"), e(h, "subtitle", "Name, photo, bio"), e(h, "trailingIcon", "explore"), e(h, "onClick", () => F("tapped Profile")), e(S, "leadingIcon", "bell"), e(S, "title", "Notifications"), e(S, "subtitle", "Sounds, badges, alerts"), e(S, "trailingIcon", "explore"), e(S, "onClick", () => F("tapped Notifications")), e(N, "leadingIcon", "settings"), e(N, "title", "Settings"), e(N, "trailingIcon", "explore"), e(N, "onClick", () => F("tapped Settings")), i;
          })(), (() => {
            var i = o("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), z((c) => e(i, "label", `last row: ${$()}`, c)), i;
          })()];
        } }), Y), L(U, k(W, { title: "PageView \u2014 swipe between pages", get children() {
          return [(() => {
            var i = o("box"), c = o("pageView"), h = o("box"), S = o("text"), N = o("box"), H = o("text"), q = o("box"), ee = o("text");
            return d(i, c), e(i, "height", 140), d(c, h), d(c, N), d(c, q), e(c, "onChange", (j) => b(j)), d(h, S), e(h, "width", "fill"), e(h, "height", 140), e(h, "background", "#FF0A84FF"), e(h, "cornerRadius", 12), e(h, "padding", 20), e(S, "label", "Page 1 \u2014 swipe \u2192"), e(S, "fontSize", 16), e(S, "fontWeight", 800), e(S, "color", "#FFFFFFFF"), d(N, H), e(N, "width", "fill"), e(N, "height", 140), e(N, "background", "#FF34C759"), e(N, "cornerRadius", 12), e(N, "padding", 20), e(H, "label", "Page 2"), e(H, "fontSize", 16), e(H, "fontWeight", 800), e(H, "color", "#FFFFFFFF"), d(q, ee), e(q, "width", "fill"), e(q, "height", 140), e(q, "background", "#FFFF9F0A"), e(q, "cornerRadius", 12), e(q, "padding", 20), e(ee, "label", "Page 3"), e(ee, "fontSize", 16), e(ee, "fontWeight", 800), e(ee, "color", "#FFFFFFFF"), z((j) => e(c, "activeTab", _(), j)), i;
          })(), (() => {
            var i = o("row"), c = o("button"), h = o("button");
            return d(i, c), d(i, h), e(i, "gap", 8), e(c, "label", "\u25C0 Prev"), e(c, "onClick", () => b(Math.max(0, _() - 1))), e(h, "label", "Next \u25B6"), e(h, "onClick", () => b(Math.min(2, _() + 1))), i;
          })(), (() => {
            var i = o("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), z((c) => e(i, "label", `page ${_() + 1} of 3 \u2014 swipe or use the buttons`, c)), i;
          })()];
        } }), Y), L(U, k(W, { title: "Pull-to-refresh + swipe-to-dismiss", get children() {
          return [(() => {
            var i = o("box"), c = o("listView");
            return d(i, c), e(i, "height", 210), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "cornerRadius", 8), e(c, "onRefresh", async () => {
              await new Promise((h) => setTimeout(h, 900)), D([`Fresh item ${++p}`, ...y()]);
            }), L(c, k(ie, { get each() {
              return y();
            }, children: (h) => (() => {
              var S = o("dismissible"), N = o("box"), H = o("text");
              return d(S, N), e(S, "onDismiss", () => D(y().filter((q) => q !== h))), d(N, H), e(N, "width", "fill"), e(N, "background", "#FFEFEFF4"), e(N, "cornerRadius", 8), e(N, "padding", 14), e(H, "label", h), e(H, "fontSize", 13), e(H, "color", "#FF1C1C1E"), S;
            })() })), i;
          })(), (() => {
            var i = o("text");
            return e(i, "label", "Pull the list down to refresh (a 900ms async task \u2014 the spinner waits for it); swipe any row sideways to dismiss it."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), Y), L(U, k(W, { title: "Slivers \u2014 collapsing header (CustomScrollView)", get children() {
          return [(() => {
            var i = o("box"), c = o("customScrollView"), h = o("sliverAppBar"), S = o("box"), N = o("text"), H = o("sliverList"), q = o("sliverGrid");
            return d(i, c), e(i, "height", 340), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "cornerRadius", 8), d(c, h), d(c, H), d(c, q), d(h, S), e(h, "title", "Collapsing header"), e(h, "height", 170), e(h, "sliverMode", "pinned"), e(h, "background", "#FF0A84FF"), d(S, N), e(S, "width", "fill"), e(S, "height", 170), e(S, "background", "#FF5E5CE6"), e(S, "padding", 20), e(N, "label", "Parallax background"), e(N, "fontSize", 18), e(N, "fontWeight", 800), e(N, "color", "#FFFFFFFF"), L(H, k(ie, { each: ["One", "Two", "Three", "Four", "Five"], children: (ee) => (() => {
              var j = o("box"), Re = o("text");
              return d(j, Re), e(j, "width", "fill"), e(j, "background", "#FFFFFFFF"), e(j, "padding", 16), e(j, "borderWidth", 1), e(j, "borderColor", "#FFE5E5EA"), e(Re, "label", `Row ${ee}`), e(Re, "fontSize", 14), e(Re, "color", "#FF1C1C1E"), j;
            })() })), e(q, "crossAxisCount", 3), e(q, "aspectRatio", 1), e(q, "gap", 8), L(q, k(ie, { each: [Le, Xe, Ye, dt, Wt, Le, Xe, Ye, dt], children: (ee) => (() => {
              var j = o("box");
              return e(j, "background", ee), e(j, "cornerRadius", 10), j;
            })() })), i;
          })(), (() => {
            var i = o("text");
            return e(i, "label", "Scroll the panel up \u2014 the purple header collapses into a pinned blue bar. The SliverList builds rows lazily; non-sliver children would auto-wrap in a SliverToBoxAdapter."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), Y), L(U, k(W, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
          return [(() => {
            var i = o("box"), c = o("text");
            return d(i, c), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), e(i, "padding", 22), e(i, "onTap", () => F("onTap")), e(i, "onLongPress", () => F("onLongPress")), e(i, "onDoubleTap", () => F("onDoubleTap")), e(c, "label", "Tap / long-press / double-tap this box"), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = o("text");
            return e(i, "fontSize", 12), e(i, "color", "#FF8E8E93"), z((c) => e(i, "label", `last gesture: ${$()}`, c)), i;
          })()];
        } }), Y), L(U, k(W, { title: "Drag \u2014 draggable (zero per-frame bridge traffic)", get children() {
          return [(() => {
            var i = o("box"), c = o("box"), h = o("text");
            return d(i, c), e(i, "height", 150), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), d(c, h), e(c, "draggable", true), e(c, "width", 64), e(c, "height", 64), e(c, "background", "#FF0A84FF"), e(c, "cornerRadius", 14), e(c, "onPanEnd", (S, N) => a(`${S.toFixed(0)}, ${N.toFixed(0)}`)), e(h, "label", "drag"), e(h, "fontSize", 12), e(h, "color", "#FFFFFFFF"), i;
          })(), (() => {
            var i = o("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), z((c) => e(i, "label", `Drag the blue box \u2014 the host moves it itself, no event per frame. Resting offset: ${v()}`, c)), i;
          })()];
        } }), Y), L(U, k(W, { title: "Pan \u2014 onPanUpdate delta stream", get children() {
          return [(() => {
            var i = o("box"), c = o("text");
            return d(i, c), e(i, "height", 70), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), e(i, "padding", 16), e(i, "onPanStart", () => g("drag started")), e(i, "onPanUpdate", (h, S) => g(`dx ${h.toFixed(1)}  dy ${S.toFixed(1)}`)), e(i, "onPanEnd", (h, S) => g(`fling v ${h.toFixed(0)}, ${S.toFixed(0)} dp/s`)), e(c, "label", "Drag anywhere on this strip"), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = o("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), z((c) => e(i, "label", `onPanUpdate: ${u()}`, c)), i;
          })()];
        } }), Y), L(U, k(W, { title: "Scale \u2014 onScaleUpdate (pinch / rotate)", get children() {
          return [(() => {
            var i = o("box"), c = o("box"), h = o("text");
            return d(i, c), e(i, "height", 170), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), d(c, h), e(c, "width", 96), e(c, "height", 96), e(c, "background", "#FF5E5CE6"), e(c, "cornerRadius", 16), e(c, "onScaleStart", () => {
              I = R();
            }), e(c, "onScaleUpdate", (S) => P(Math.max(0.3, I * S))), e(h, "label", "pinch"), e(h, "fontSize", 13), e(h, "color", "#FFFFFFFF"), z((S) => {
              var N = R(), H = R();
              return N !== S.e && (S.e = e(c, "scaleX", N, S.e)), H !== S.t && (S.t = e(c, "scaleY", H, S.t)), S;
            }, { e: undefined, t: undefined }), i;
          })(), (() => {
            var i = o("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), z((c) => e(i, "label", `Pinch the purple box (two pointers / trackpad). Scale \xD7${R().toFixed(2)}`, c)), i;
          })()];
        } }), Y), L(U, k(W, { title: "Dialogs \u2014 imperative JS API", get children() {
          return [(() => {
            var i = o("row"), c = o("button"), h = o("button");
            return d(i, c), d(i, h), e(i, "gap", 8), e(c, "label", "Alert"), e(c, "onClick", async () => {
              await Fr({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), J("alert: dismissed");
            }), e(h, "label", "Confirm"), e(h, "onClick", async () => {
              J(`confirm \u2192 ${await Fr({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
            }), i;
          })(), (() => {
            var i = o("row"), c = o("button"), h = o("button");
            return d(i, c), d(i, h), e(i, "gap", 8), e(c, "label", "Action sheet"), e(c, "onClick", async () => {
              J(`sheet \u2192 ${await Vn({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
            }), e(h, "label", "Snackbar"), e(h, "onClick", () => {
              _r("Hello from a snackbar \uD83D\uDC4B"), J("snackbar: shown");
            }), i;
          })(), (() => {
            var i = o("text");
            return e(i, "fontSize", 12), e(i, "color", "#FF8E8E93"), z((c) => e(i, "label", Z(), c)), i;
          })()];
        } }), Y), L(U, k(W, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
          return [(() => {
            var i = o("text");
            return e(i, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = o("box");
            return e(i, "height", 320), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), L(i, k(Je.View, {})), i;
          })()];
        } }), Y), L(U, k(W, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
          return [(() => {
            var i = o("text");
            return e(i, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = o("box"), c = o("tabs"), h = o("tab"), S = o("column"), N = o("text"), H = o("text"), q = o("tab"), ee = o("column"), j = o("text"), Re = o("textInput"), ht = o("tab"), me = o("column"), Ke = o("text"), Ft = o("text");
            return d(i, c), e(i, "height", 280), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "cornerRadius", 8), d(c, h), d(c, q), d(c, ht), e(c, "onChange", Bt), e(c, "height", "fill"), d(h, S), e(h, "title", "Home"), e(h, "icon", "home"), d(S, N), d(S, H), e(S, "background", "#FFF2F2F7"), e(S, "padding", 16), e(S, "gap", 8), e(S, "height", "fill"), e(N, "label", "Home"), e(N, "fontSize", 20), e(N, "fontWeight", 800), e(N, "color", "#FF1C1C1E"), e(H, "label", "Switch tabs and come back \u2014 this tab was never torn down."), e(H, "fontSize", 13), e(H, "color", "#FF8E8E93"), d(q, ee), e(q, "title", "Search"), e(q, "icon", "search"), d(ee, j), d(ee, Re), e(ee, "background", "#FFF2F2F7"), e(ee, "padding", 16), e(ee, "gap", 8), e(ee, "height", "fill"), e(j, "label", "Search"), e(j, "fontSize", 20), e(j, "fontWeight", 800), e(j, "color", "#FF1C1C1E"), e(Re, "placeholder", "Type to search\u2026"), d(ht, me), e(ht, "title", "Profile"), e(ht, "icon", "person"), d(me, Ke), d(me, Ft), e(me, "background", "#FFF2F2F7"), e(me, "padding", 16), e(me, "gap", 8), e(me, "height", "fill"), e(Ke, "label", "Profile"), e(Ke, "fontSize", 20), e(Ke, "fontWeight", 800), e(Ke, "color", "#FF1C1C1E"), e(Ft, "fontSize", 13), e(Ft, "color", "#FF8E8E93"), z((Pe) => {
              var yr = je(), $r = `active tab index: ${je()}`;
              return yr !== Pe.e && (Pe.e = e(c, "activeTab", yr, Pe.e)), $r !== Pe.t && (Pe.t = e(Ft, "label", $r, Pe.t)), Pe;
            }, { e: undefined, t: undefined }), i;
          })()];
        } }), Y), L(U, k(W, { title: "SafeArea", get children() {
          var i = o("safeArea"), c = o("box"), h = o("text");
          return d(i, c), d(c, h), e(c, "background", "#FFEFEFF4"), e(c, "cornerRadius", 8), e(c, "padding", 14), e(h, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), e(h, "fontSize", 12), e(h, "color", "#FF1C1C1E"), i;
        } }), Y), e(Y, "label", "\u2014 end of UI demo \u2014"), e(Y, "fontSize", 12), e(Y, "color", "#FF8E8E93"), U;
      })();
    }
    return k(Pi.View, {});
  }
  var xr = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], bi = Array.from({ length: 15000 }, (t, r) => ({ author: `@user${r * 2654435761 >>> 17}`, body: xr[r % xr.length], num: r + 1 })), vi = [50, 200, 500, 1000, 2000, 5000, 1e4], Cr = "#FFF1F5F9", Or = "#FF475569", Ei = "#FF22C55E", pi = "#FFEF4444", Ar = "#FFFFFFFF";
  function Si(t) {
    const [r, n] = V(0), [l, s] = V(false), [f, w] = V(0), [E, A] = V(false);
    return (() => {
      var C = o("column"), T = o("text"), m = o("text"), $ = o("row"), F = o("button"), _ = o("button");
      return d(C, T), d(C, m), d(C, $), e(C, "background", "#FFFFFFFF"), e(C, "padding", 12), e(C, "cornerRadius", 10), e(C, "borderWidth", 1), e(C, "borderColor", "#FFE5E5EA"), e(C, "gap", 6), e(T, "fontWeight", 700), e(T, "fontSize", 14), e(T, "color", "#FF1DA1F2"), e(m, "fontSize", 14), e(m, "color", "#FF1F2937"), e(m, "maxLines", 3), e(m, "textOverflow", 1), d($, F), d($, _), e($, "gap", 10), e(F, "fontSize", 12), e(F, "padding", 6), e(F, "cornerRadius", 16), e(F, "onClick", () => {
        const b = !l();
        s(b), n(r() + (b ? 1 : -1));
      }), e(_, "fontSize", 12), e(_, "padding", 6), e(_, "cornerRadius", 16), e(_, "onClick", () => {
        const b = !E();
        A(b), w(f() + (b ? 1 : -1));
      }), z((b) => {
        var y = `#${t.num} \xB7 ${t.author}`, D = t.body, p = `\u2665 ${r()}`, v = l() ? Ei : Cr, a = l() ? Ar : Or, u = `\u21A9 ${f()}`, g = E() ? pi : Cr, R = E() ? Ar : Or;
        return y !== b.e && (b.e = e(T, "label", y, b.e)), D !== b.t && (b.t = e(m, "label", D, b.t)), p !== b.a && (b.a = e(F, "label", p, b.a)), v !== b.o && (b.o = e(F, "background", v, b.o)), a !== b.i && (b.i = e(F, "color", a, b.i)), u !== b.n && (b.n = e(_, "label", u, b.n)), g !== b.s && (b.s = e(_, "background", g, b.s)), R !== b.h && (b.h = e(_, "color", R, b.h)), b;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), C;
    })();
  }
  function wi() {
    const [t, r] = V(50), [n, l] = V(""), s = tt(() => bi.slice(0, t()));
    return (() => {
      var f = o("listView"), w = o("text"), E = o("text"), A = o("wrap"), C = o("text");
      return d(f, w), d(f, E), d(f, A), d(f, C), e(f, "background", "#FFF2F2F7"), e(f, "padding", 16), e(f, "gap", 12), e(w, "label", "Tweet feed \u2014 virtualized"), e(w, "fontSize", 24), e(w, "fontWeight", 800), e(w, "color", "#FF1C1C1E"), e(E, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), e(E, "fontSize", 13), e(E, "color", "#FF8E8E93"), e(A, "gap", 6), L(A, k(ie, { each: vi, children: (T) => (() => {
        var m = o("button");
        return e(m, "label", `${T}`), e(m, "onClick", () => {
          const $ = performance.now();
          try {
            r(T), l(`mounted ${T} in ${(performance.now() - $).toFixed(2)} ms`);
          } catch (F) {
            l(`ERROR @ ${T}: ${F && (F.message || String(F)) || "unknown"}`);
          }
        }), m;
      })() })), e(C, "fontSize", 12), e(C, "color", "#FF8E8E93"), L(f, k(ie, { get each() {
        return s();
      }, children: (T) => k(Si, { get author() {
        return T.author;
      }, get body() {
        return T.body;
      }, get num() {
        return T.num;
      } }) }), null), z((T) => e(C, "label", n() || `showing ${t()} tweets`, T)), f;
    })();
  }
  function Ri() {
    const [t, r] = V("\u2014 waiting for counter events \u2014"), n = fi(), [l, s] = V("\u2014 tap a button to RPC the Ticker \u2014"), [f, w] = V(null), [E, A] = V(false);
    return (() => {
      var C = o("scrollView"), T = o("text"), m = o("text"), $ = o("text");
      return d(C, T), d(C, m), d(C, $), e(C, "background", "#FFF2F2F7"), e(C, "padding", 16), e(C, "gap", 14), e(T, "label", "Libraries \u2014 codegen-wrapped widgets"), e(T, "fontSize", 24), e(T, "fontWeight", 800), e(T, "color", "#FF1C1C1E"), e(m, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), e(m, "fontSize", 13), e(m, "color", "#FF8E8E93"), L(C, k(W, { title: "Greeting \u2014 hand-written adapter", get children() {
        var F = o("greeting");
        return e(F, "name", "Skal"), e(F, "color", "#FF1DA1F2"), e(F, "fontSize", 20), F;
      } }), $), L(C, k(W, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var F = o("text");
          return e(F, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), e(F, "fontSize", 11), e(F, "color", "#FF8E8E93"), F;
        })(), (() => {
          var F = o("shimmerFromColors"), _ = o("greeting");
          return d(F, _), e(F, "baseColor", 4290624957), e(F, "highlightColor", 4292927712), e(F, "period", 1500), e(_, "name", "loading\u2026"), e(_, "color", "#FF333333"), e(_, "fontSize", 28), F;
        })()];
      } }), $), L(C, k(W, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var F = o("qrImageView");
          return e(F, "data", "https://skal.dev"), e(F, "size", 200), F;
        })(), (() => {
          var F = o("text");
          return e(F, "label", "QrImageView, generated against qr_flutter's class."), e(F, "fontSize", 11), e(F, "color", "#FF8E8E93"), F;
        })()];
      } }), $), L(C, k(W, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var F = o("text");
          return e(F, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), e(F, "fontSize", 11), e(F, "color", "#FF8E8E93"), F;
        })(), (() => {
          var F = o("button");
          return e(F, "onClick", () => A(!E())), z((_) => e(F, "label", E() ? "Stop camera" : "Start camera", _)), F;
        })(), zt(() => zt(() => !!E())() && (() => {
          var F = o("box"), _ = o("camera");
          return d(F, _), e(F, "background", "#FF000000"), e(F, "padding", 4), e(F, "cornerRadius", 8), e(_, "resolutionIndex", 1), F;
        })())];
      } }), $), L(C, k(W, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var F = o("counter");
          return e(F, "initial", 0), e(F, "onChanged", (_) => r(`onChanged(${_})`)), e(F, "onReset", () => r("onReset()")), F;
        })(), (() => {
          var F = o("text");
          return e(F, "fontSize", 13), e(F, "color", "#FF1C1C1E"), z((_) => e(F, "label", t(), _)), F;
        })()];
      } }), $), L(C, k(W, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var F = o("ticker");
          return ci(n, F), e(F, "intervalMs", 500), F;
        })(), (() => {
          var F = o("wrap"), _ = o("button"), b = o("button"), y = o("button"), D = o("button"), p = o("button"), v = o("button"), a = o("button"), u = o("button");
          return d(F, _), d(F, b), d(F, y), d(F, D), d(F, p), d(F, v), d(F, a), d(F, u), e(F, "gap", 6), e(_, "label", "pause"), e(_, "onClick", async () => {
            await n.pause(), s("pause() \u2713");
          }), e(b, "label", "resume"), e(b, "onClick", async () => {
            await n.resume(), s("resume() \u2713");
          }), e(y, "label", "reset"), e(y, "onClick", async () => {
            await n.reset(), s("reset() \u2713");
          }), e(D, "label", "+10"), e(D, "onClick", async () => {
            await n.bump(10), s(`bump(10), now getValue() \u2192 ${await n.getValue()}`);
          }), e(p, "label", "read"), e(p, "onClick", async () => {
            s(`getValue() \u2192 ${await n.getValue()}, isPaused() \u2192 ${await n.isPaused()}`);
          }), e(v, "label", "describe"), e(v, "onClick", async () => {
            s(`describe() \u2192 ${await n.describe("hello from JSX")}`);
          }), e(a, "label", "snapshot"), e(a, "onClick", async () => {
            const g = await n.snapshot();
            s(`snapshot() \u2192 value=${g.value} paused=${g.paused} ts=${g.timestamp}`);
          }), e(u, "label", "sub/unsub"), e(u, "onClick", () => {
            if (f())
              f()(), w(() => null), s("unsubscribed from ticks$");
            else {
              const g = n.ticks$((R) => {
                s(`stream tick: ${R}`);
              });
              w(() => g), s("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), F;
        })(), (() => {
          var F = o("text");
          return e(F, "fontSize", 13), e(F, "color", "#FF1C1C1E"), z((_) => e(F, "label", l(), _)), F;
        })()];
      } }), $), L(C, k(W, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var F = o("stickers"), _ = o("greeting"), b = o("greeting"), y = o("greeting");
        return d(F, _), d(F, b), d(F, y), e(F, "gap", 6), e(F, "padding", 10), e(F, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), e(_, "name", "multi-child A"), e(_, "color", "#FF6B4F00"), e(_, "fontSize", 14), e(b, "name", "multi-child B"), e(b, "color", "#FF6B4F00"), e(b, "fontSize", 14), e(y, "name", "multi-child C"), e(y, "color", "#FF6B4F00"), e(y, "fontSize", 14), F;
      } }), $), e($, "label", "\u2014 end of Libs demo \u2014"), e($, "fontSize", 12), e($, "color", "#FF8E8E93"), C;
    })();
  }
  function mi() {
    const [t, r] = V(0);
    return (() => {
      var n = o("tabs"), l = o("tab"), s = o("tab"), f = o("tab");
      return d(n, l), d(n, s), d(n, f), e(n, "onChange", r), e(n, "height", "fill"), e(l, "title", "UI"), e(l, "icon", "grid"), L(l, k(_i, {})), e(s, "title", "List"), e(s, "icon", "list"), L(s, k(wi, {})), e(f, "title", "Libs"), e(f, "icon", "explore"), L(f, k(Ri, {})), z((w) => e(n, "activeTab", t(), w)), n;
    })();
  }
  si(() => k(mi, {}), ui);
})();
})
